define([
    'backbone',
    'jquery',
    'airDatepicker',
    'airDatepickerEN',
    'js/view/basemap.js',
    'js/view/layers.js',
], function (Backbone, $, airDatepicker, airDatepickerEN, Basemap, Layers) {
    return Backbone.View.extend({
        initBounds: [[-21.961179941367273,93.86358289827513],[16.948660219367564,142.12675002072507]],
        initialize: function () {
            // constructor
            this.map = L.map('map').setView([51.505, -0.09], 13).fitBounds(this.initBounds);
            this.basemap = new Basemap(this);
            this.layers = new Layers(this);
            L.control.layers(
                this.basemap.basemaps,
                this.layers.groups, {position: 'topleft'}).addTo(this.map);
            this.initDraw();
            this.listenTo(dispatcher, 'map:redraw', this.redraw);
        },
        redraw: function () {
            $.each(this.layers.layers, function (index, layer) {
                layer.addLayer();
            });
        },
        initDraw: function () {
            /** initiate leaflet draw **/
            let that = this;
            this.drawGroup = new L.FeatureGroup();
            this.drawControl = new L.Control.Draw({
                draw: {
                    polygon: true,
                    polyline: false,
                    circlemarker: false,
                    marker: false,
                    circle: false,
                    rectangle: false
                },
                edit: {
                    featureGroup: this.drawGroup,
                    edit: false
                }
            });
            this.map.addControl(this.drawControl);
            this.map.addLayer(this.drawGroup);

            this.map.on('draw:created', (e) => {
                that.drawGroup.clearLayers();
                that.drawGroup.addLayer(e.layer);
                var popupContent = '<form role="form" id="draw-form" enctype="multipart/form-data" class="form-horizontal">' +
                    '<div class="form-group">' +
                    '<input type="checkbox" id="enable_forecast_date" onchange="$(\'#forecast_date\').prop(\'disabled\', function(i, v) { return !v; })">&nbsp;<label for="forecast_date">Forecast date: </label>' +
                    '<input class="form-control" type="text" id="forecast_date" disabled><br/>' +
                    '<input type="checkbox" id="enable_station" onchange="$(\'#station\').prop(\'disabled\', function(i, v) { return !v; })">&nbsp;<label for="station">Station: </label><input class="form-control" type="text" id="station" disabled><br/>' +
                    '<button type="submit" value="submit" class="btn btn-primary">Save</button>' +
                    '<button type="button" id="cancel-draw" class="btn btn-default">Cancel</button>' +
                    '</div></form>';
                that.drawGroup.bindPopup(popupContent,{
                    keepInView: true,
                    closeButton: false,
                    closeOnClick: false
                    }).openPopup();

                $('#forecast_date').datepicker({
                    language: 'en',
                    timepicker: true
                });

                $("#draw-form").submit(function(e){
                    e.preventDefault();
                    dispatcher.trigger('map:update-polygon', that.postgrestFilter());
                    that.drawGroup.closePopup().unbindPopup();
                });

                $('#cancel-draw').click(function () {
                    that.drawGroup.closePopup().unbindPopup();
                    that.drawGroup.removeLayer(e.layer);
                })
            });

            this.map.on('draw:deleted', (evt) => {
                dispatcher.trigger('map:update-polygon', that.postgrestFilter());
                that.redraw();
            });
        },
        polygonDrawn: function () {
            if (this.drawGroup && this.drawGroup.getLayers().length > 0) {
                let locations = [];
                $.each(this.drawGroup.getLayers()[0].getLatLngs()[0], (index, latLng) => {
                    locations.push(latLng.lng + ' ' + latLng.lat)
                });

                // add first point to make it closed
                let firstPoint = this.drawGroup.getLayers()[0].getLatLngs()[0];
                locations.push(firstPoint[0].lng + ' ' + firstPoint[0].lat)
                return locations
            } else {
                return null;
            }
        },
        cqlFilter: function () {
            /** get cql from drawn polygon **/
            if (!this.layers) {
                return null;
            }
            let flood_id = this.layers.polygonStatistic.polygonID;
            if (flood_id) {
                return "flood_id=" + flood_id;
            } else {
                return null
            }
        },
        postgrestFilter: function () {
            /** get postgrest from drawn polygon **/
            let locations = this.polygonDrawn();
            if (locations) {
                return 'SRID=4326;MULTIPOLYGON(((' + locations.join(',') + ')))';
            } else {
                return null
            }


        }
    });
});