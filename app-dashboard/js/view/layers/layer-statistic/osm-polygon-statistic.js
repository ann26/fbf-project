define([
    'backbone', 'leaflet'], function (
    Backbone, L) {
    return Backbone.View.extend({
        xhrPolygon: null,
        polygon: null,
        polygonName: null,
        polygonID: null,
        initialize: function (statistics) {
            /**
             * multiselect view of backbone
             * Take filters value as the query for update the status
             * **/
            this.listenTo(dispatcher, 'map:update-polygon', this.updatePolygon);
            this.statistics = statistics;
        },
        deletePolygon: function () {
            this.polygon = null;
            if (this.polygonID) {
                AppRequest.delete(
                    postgresUrl + 'flood?id=eq.' + this.polygonID,
                    {},
                    null,
                    null);
            }
            this.polygonName = null;
            this.polygonID = null;
        },
        updatePolygon: function (polygon) {
            let that = this;
            this.deletePolygon();
            this.polygon = polygon;
            $.each(this.statistics, (index, statistic) => {
                statistic.loading();
            });
            if (this.polygon) {
                let polygonName = (new Date()).toISOString().replaceAll(':', '_');
                polygonName = polygonName.replaceAll('-', '_');
                polygonName = polygonName.replaceAll('T', '_');
                polygonName = polygonName.split('.')[0];
                polygonName = 'flood_' + polygonName;
                let post_data = {
                    'geometry': that.polygon,
                    'name': polygonName,
                    'reporting_date_time': new Date().toMysqlFormat(),
                    'source': 'user',
                    'station': $('#station').val()
                };

                if ($('#enable_forecast_date').is(':checked')) {
                    post_data['forecast_date_time'] = new Date($('#forecast_date').val()).toMysqlFormat();
                }

                if ($('#enable_station').is(':checked')) {
                    post_data['station'] = $('#station').val();
                }

                that.xhrPolygon = AppRequest.post(
                    postgresUrl + 'flood',
                    post_data,
                    null,
                    function (data, textStatus, request) {
                        if (data['status'] === 201) {
                            // get the id
                            that.xhrPolygon = AppRequest.get(
                                postgresUrl + 'flood',
                                {
                                    order: 'id.desc'
                                },
                                {
                                    'Range-Unit': 'items',
                                    'Range': '0-0',
                                    'Prefer': 'count=exact'
                                },
                                function (data, textStatus, request) {
                                    if (data[0]) {
                                        that.polygonID = data[0].id;
                                        that.polygonName = polygonName;
                                        that.updateStats();
                                        dispatcher.trigger('map:redraw');
                                    }
                                },
                                function (data, textStatus, request) {
                                    console.log(data);
                                });
                        }
                    });
            } else {
                that.updateStats(null);
            }
        },
        updateStats: function () {
            let that = this;
            $.each(this.statistics, (index, statistic) => {
                statistic.polygonName = that.polygonName;
                statistic.polygonID = that.polygonID;
                statistic.updateStats();
            });
        }
    });
});