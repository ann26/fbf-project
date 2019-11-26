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
            // this.map.addControl(this.drawControl);

            let polygonDrawer = new L.Draw.Polygon(that.map);
            
            $('#draw-flood').click(function () {
                if ($(this).hasClass('enable')) {
                    polygonDrawer.disable();
                    $(this).removeClass('enable');
                } else {
                    polygonDrawer.enable();
                    $(this).addClass('enable');
                }
            });
            
            this.map.addLayer(this.drawGroup);

            this.map.on('draw:created', (e) => {
                that.drawGroup.clearLayers();
                that.drawGroup.addLayer(e.layer);
                $('#draw-flood-form').show();

                $('#cancel-draw').click(function () {
                    that.drawGroup.removeLayer(e.layer);
                    $('#draw-flood').removeClass('enable');
                });

                $("#draw-form").submit(function(e){
                    e.preventDefault();
                    dispatcher.trigger('map:update-polygon', that.postgrestFilter());
                    $('#draw-flood').removeClass('enable');
                    $('#draw-flood-form').hide();
                });
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