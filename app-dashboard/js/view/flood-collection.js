define([
    'backbone', 'underscore', 'leaflet', 'wellknown', 'js/view/dummy-data.js'
], function (Backbone, _, L, Wellknown) {
    return Backbone.View.extend({
        flood_collection: null,
        flood_on_date: null,
        displayed_flood: null,
        flood_dates: [],
        villageStats: null,
        subDistrictStats: null,
        districtStats: null,
        areaLookup: null,
        dummyFlood: {
            name: 'Dummy Flood',
            id: 15,
        },
        initialize: function () {
            this.fetchFloodCollection();
            dispatcher.on('flood:fetch-flood', this.fetchFlood, this);
            dispatcher.on('flood:fetch-flood-by-id', this.fetchFloodByID, this);
            dispatcher.on('flood:fetch-stats-data', this.fetchStatisticData, this)
        },
        fetchFloodCollection: function () {
            let $floodListBtn = $('#date-browse-flood');
            let that = this;
            this.xhrPolygon = AppRequest.get(
                postgresUrl + 'flood_wkt_view',
                {
                    order: 'forecast_date_time.asc'
                },
                {
                    'Range-Unit': 'items',
                    'Range': '',
                    'Prefer': ''
                },
                function (data, textStatus, request) {
                    $floodListBtn.val('Select a date');

                    let flood_dates = [];
                    let flood_collection_array = {};
                    $.each(data, function (index, value) {
                        if (value['forecast_date_time'] !== null) {
                            let date = new Date(value['forecast_date_time'] + 'Z');

                            date.setUTCHours(0, 0, 0, 0);
                            let string_date = date.toISOString();

                            if(!flood_collection_array.hasOwnProperty(string_date)){
                                flood_collection_array[string_date] = [value]
                                flood_dates.push(string_date);
                                that.flood_dates.push(new Date(string_date))
                            }else {
                                flood_collection_array[string_date].push(value)
                            }
                        }
                    });
                    that.flood_collection = flood_collection_array;

                    $('.datepicker-browse').datepicker({
                        language: 'en',
                        autoClose: true,
                        dateFormat: 'dd/mm/yyyy',
                        onRenderCell: function (date, cellType) {
                            let _date = new Date(date);
                            _date.setTime(_date.getTime() - _date.getTimezoneOffset() * 60 * 1000);
                            _date.setUTCHours(0,0,0,0);
                            if (cellType === 'day' && flood_dates.indexOf(_date.toISOString()) > -1) {
                                return {
                                    classes: 'flood-date'
                                }
                            }
                        },
                        onSelect: function onSelect(fd, date) {
                            let flood_data = that.fetchFlood(date);
                            if(flood_data != null) {
                                that.displayed_flood = flood_data[0];

                                that.fetchAreaLookUp(that.displayed_flood.id);
                                that.fetchVillageData(that.displayed_flood.id);
                                that.fetchSubDistrictData(that.displayed_flood.id);
                                that.fetchDistrictData(that.displayed_flood.id);

                                let polygon = Wellknown.parse('SRID=4326;' + that.displayed_flood['st_astext']);
                                dispatcher.trigger('map:draw-geojson', polygon);
                                $('.flood-info').html('<div>' + flood_data[0].name + '</div>');
                                if(flood_data.length > 1){
                                    $('.browse-arrow').show();
                                    $('.arrow-down').attr('data-flood-id', flood_data[1]['id']).prop('disabled', false);
                                }else {
                                    $('.browse-arrow').prop('disabled', true).hide();
                                }
                            }else {
                                that.displayed_flood = null;
                                $('.flood-info').html('');
                                dispatcher.trigger('map:remove-geojson');
                                $('.browse-arrow').prop('disabled', true).hide();
                            }

                            // Enable or disable next and previous button.
                            let _date = new Date(date);
                            _date.setTime(_date.getTime() - _date.getTimezoneOffset() * 60 * 1000);
                            _date.setUTCHours(0,0,0,0);
                            let flood_dates = that.flood_dates;
                            let beforedates = flood_dates.filter(function(d) {
                                return d - _date < 0;
                            });

                            let afterdates = flood_dates.filter(function(d) {
                                return d - _date > 0;
                            });

                            if(beforedates.length < 1){
                                $('#prev-date').prop('disabled', true)
                            }else {
                                $('#prev-date').prop('disabled', false)
                            }

                            if(afterdates.length < 1){
                                $('#next-date').prop('disabled', true)
                            }else {
                                $('#next-date').prop('disabled', false)
                            }

                        }
                    });
                },
                function (data, textStatus, request) {
                    $floodListBtn.val('Fetch failed.');
                    console.log(data);
                });
        },
        fetchFlood: function (date) {
            if(date) {
                let that = this;
                let _date = new Date(date);
                _date.setTime(_date.getTime() - _date.getTimezoneOffset() * 60 * 1000);
                _date.setUTCHours(0, 0, 0, 0);
                let string_date = _date.toISOString();
                that.flood_on_date = that.flood_collection[string_date];
                
                return that.flood_on_date
            }else {
                return null
            }
        },
        fetchFloodByID: function (id) {
            let that = this;
            let lengthArray = that.flood_on_date.length - 1;

            for(var i=0; i<lengthArray + 1; i++) {
                let flood = that.flood_on_date[i];
                if(flood['id'] === parseInt(id)){
                    that.displayed_flood = flood;
                    that.fetchDistrictData(flood[0].id);
                    let prev = '';
                    let after = '';

                    if (i > 0) {
                        prev = that.flood_on_date[i - 1]['id'];
                        $('.arrow-up').prop('disabled', false).attr('data-flood-id', prev);
                    } else {
                        $('.arrow-up').prop('disabled', true)
                    }

                    if (i < lengthArray) {
                        after = that.flood_on_date[i + 1]['id'];
                        $('.arrow-down').prop('disabled', false).attr('data-flood-id', after);
                    } else {
                        $('.arrow-down').prop('disabled', true)
                    }
                    $('.flood-info').html('<div>' + flood['name'] + '</div>');

                    let polygon = Wellknown.parse('SRID=4326;' + flood['st_astext']);
                    dispatcher.trigger('map:draw-geojson', polygon);
                    break;
                }
            }
        },
        fetchStatisticData: function (region, region_id, renderRegionDetail) {
            if(!region) {
                return []
            }

            let that = this;
            let data = {
                'village': that.villageStats,
                'district': that.districtStats,
                'sub_district': that.subDistrictStats
            };

            let buildings = [];
            let overall = [];
            let region_render;
            let main_panel = true;
            if(renderRegionDetail) {
                region_render = region;
                $.each(data[region], function (idx, value) {
                    buildings[idx] = [];
                    $.each(value, function (key, value) {
                        buildings[idx][key] = value;
                        if (!overall[key]) {
                            overall[key] = value
                        } else {
                            overall[key] += value
                        }
                    })
                });
                if(overall.hasOwnProperty('police_flooded_building_count')) {
                    overall['police_station_flooded_building_count'] = overall['police_flooded_building_count'];
                    delete overall['police_flooded_building_count'];
                }
                delete overall[region + '_id'];
                delete overall['name'];
                delete overall['village_code'];
                delete overall['sub_dc_code'];
            }else {
                main_panel = false;
                let sub_region = 'sub_district';
                if(region === 'sub_district'){
                    sub_region = 'village'
                }
                region_render = sub_region;

                let statData = [];
                let key = {
                    'sub_district': 'sub_district_id',
                    'village': 'village_id'
                };
                let subRegionList = that.getListSubRegion(sub_region, region_id);
                $.each(data[sub_region], function (index, value) {
                    if(subRegionList.indexOf(value[key[sub_region]])){
                        statData.push(value)
                    }
                });

                if(region !== 'village') {
                    $.each(statData, function (idx, value) {
                        buildings[idx] = [];
                        $.each(value, function (key, value) {
                            if(key === 'police_flooded_building_count'){
                                key = 'police_station_flooded_building_count'
                            }
                            buildings[idx][key] = value;
                        })
                    });
                }

                for(let index=0; index<data[region].length; index++){
                    if(data[region][index]['id'] === parseInt(region_id)){
                        overall = data[region][index];
                        if(overall.hasOwnProperty('police_flooded_building_count')) {
                            overall['police_station_flooded_building_count'] = overall['police_flooded_building_count'];
                            delete overall['police_flooded_building_count'];
                        }
                        break
                    }
                }
                overall['region'] = region;
            }
            dispatcher.trigger('dashboard:render-chart-2', overall, main_panel);

            if(region !== 'village') {
                dispatcher.trigger('dashboard:render-region-summary', buildings, region_render)
            }
        },
        fetchVillageData: function (flood_event_id) {
            flood_event_id = 15;
            let that = this;
            this.xhrVillageStats = AppRequest.get(
                postgresUrl + 'flood_event_village_summary_mv?flood_event_id=eq.' + flood_event_id,
                {
                    order: 'id.asc'
                },
                {
                    'Range-Unit': 'items',
                    'Range': '',
                    'Prefer': ''
                },
                function (data, textStatus, request) {
                    that.villageStats = data;
                    if(that.villageStats !== null && that.districtStats !== null && that.subDistrictStats !== null) {
                        that.fetchStatisticData('district', that.displayed_flood['id'], true);
                    }
                },function (data, textStatus, request) {
                    console.log('Village stats request failed');
                    console.log(data)
                })
        },
        fetchDistrictData: function (flood_event_id) {
            flood_event_id = 15;
            let that = this;
            this.xhrDistrictStats = AppRequest.get(
                postgresUrl + 'flood_event_district_summary_mv?flood_event_id=eq.' + flood_event_id,
                {
                    order: 'id.asc'
                },
                {
                    'Range-Unit': 'items',
                    'Range': '',
                    'Prefer': ''
                },
                function (data, textStatus, request) {
                    that.districtStats = data;
                    if(that.villageStats !== null && that.districtStats !== null && that.subDistrictStats !== null) {
                        that.fetchStatisticData('district', that.displayed_flood['id'], true);
                    }
                },function (data, textStatus, request) {
                    console.log('District stats request failed');
                    console.log(data)
                })
        },
        fetchSubDistrictData: function (flood_event_id) {
            flood_event_id = 15;
            let that = this;
            this.xhrSubDistrictStats = AppRequest.get(
                postgresUrl + 'flood_event_sub_district_summary_mv?flood_event_id=eq.' + flood_event_id,
                {
                    order: 'id.asc'
                },
                {
                    'Range-Unit': 'items',
                    'Range': '',
                    'Prefer': ''
                },
                function (data, textStatus, request) {
                    that.subDistrictStats = data;
                    if(that.villageStats !== null && that.districtStats !== null && that.subDistrictStats !== null) {
                        that.fetchStatisticData('district', that.displayed_flood['id'], true);
                    }
                },function (data, textStatus, request) {
                    console.log('Sub district stats request failed');
                    console.log(data)
                })
        },
        fetchAreaLookUp: function (flood_event_id) {
            let that = this;
            this.xhrSubDistrictStats = AppRequest.get(
                postgresUrl + 'flood_event_sub_district_summary_mv?flood_event_id=eq.' + flood_event_id,
                {
                    order: 'id.asc'
                },
                {
                    'Range-Unit': 'items',
                    'Range': '',
                    'Prefer': ''
                },
                function (data, textStatus, request) {
                    that.areaLookup = data;
                },function (data, textStatus, request) {
                    console.log('Area lookup request failed');
                    console.log(data)
                })
        },
        getListSubRegion: function (region, district_id) {
            let key = {
                'sub_district': 'sub_dc_code',
                'village': 'village_code'
            };
            let keyParent = {
                'sub_district': 'dc_code',
                'village': 'sub_dc_code'
            };
            let that = this;
            let listSubRegion = [];
            $.each(that.areaLookup, function (index, value) {
                if(parseInt(value[keyParent[region]]) === parseInt(district_id)){
                    listSubRegion.push(value[key[region]])
                }
            });
            return listSubRegion
        }
    })
});