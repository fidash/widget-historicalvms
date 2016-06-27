/*global MashupPlatform, AmCharts, $, d3, FIDASHRequests */

/*
 * widget-historicalvms
 * https://github.com/fidash/widget-historicalvms
 *
 * Copyright (c) 2016 CoNWeT
 * Licensed under the Apache-2.0 license.
 */

/* exported WidgetHistoricalVms */

var WidgetHistoricalVms = (function () {

    "use strict";


    /*********************************************************
     ************************CONSTANTS*************************
     *********************************************************/

    const url = "http://130.206.84.4:11027/monitoring/regions/";
    // var flavorurl = "http://130.206.113.159:8086/api/v1";
    const colors = { ram: "#fdd400", disk: "#67b7dc", vcpu: "#84b761" };

    /*********************************************************
     ************************VARIABLES*************************
     *********************************************************/

    var downloadingData = {};

    /********************************************************/
    /**********************CONSTRUCTOR***********************/
    /********************************************************/

    var WidgetHistoricalVms = function WidgetHistoricalVms () {
        this.token = "";
        this.chart = null;
        this.fulldata = {};
        this.limits = true;
        this.multigraph = true;
        this.singleregion = "";
        this.singlevm = "";
        this.regions = [];
        this.last_regions = [];

        this.vmsByRegion = {};
        this.torequest = [];

        this.startDate = null;
        this.endDate = null;
        this.init = false;

        this.variables = {
            regionSelected: MashupPlatform.widget.getVariable("regionSelected"),
            limit: MashupPlatform.widget.getVariable("limit"),
            multi: MashupPlatform.widget.getVariable("multi")
        };

        // MashupPlatform.prefs.registerCallback(function (new_preferences) {

        // }.bind(this));

        $("#wizard").easyWizard({
            showSteps: false,
            showButtons: false,
            submitButton: false
        });


        handleVariables();

        $("[name='select-charts-region']").bootstrapSwitch();

        setHandlers.call(this);

        $("#wizard").easyWizard('resize', $("#wizard").find('.active'));

        // this.singleregion = "Lannion2";

        loadRegions.call(this);

        // getRegionData.call(this, this.singleregion, function (data) {
        //     var width = $(document).width();
        //     drawHorizon.call(this, data, this.singleregion, width);

        //     // var multi = this.variables.multi.get() !== "false",
        //     //     limit = this.variables.limit.get() !== "false";

        //     // this.chart = viewSingleRegion(data, this.singleregion, multi, limit);
        // }.bind(this));

        // cubismChart.call(this);
    };

    /*********************************************************
     **************************PRIVATE*************************
     *********************************************************/


    var diffArrays = function diffArrays(a, b) {
        return a.filter(function (i) {return b.indexOf(i) < 0;});
    };

    var drawVm = function drawVm(region, vm) {
        if (downloadingData[region][vm]) {
            return;
        }

        getVmData.call(this, region, vm, function (data) {
            // Check that is still checked
            var regions = $("#region_selector").val() || [];
            var selected = regions.filter(x => x === region).length > 0;
            if (selected) {
                var width = $(document).width();
                drawHorizon.call(this, data, region, width, vm);
            }

            startRequests.call(this);

        }.bind(this), function (err) {
            MashupPlatform.widget.log(err);
            startRequests.call(this);
        }.bind(this));

        // getRegionData.call(this, region, function (data) {
        //     // Check that is still checked
        //     var regions = $("#region_selector").val() || [];
        //     var selected = regions.filter(x => x === region).length > 0;
        //     if (selected) {
        //         var width = $(document).width();
        //         drawHorizon.call(this, data, region, width);
        //     }

        //     // var multi = this.variables.multi.get() !== "false",
        //     //     limit = this.variables.limit.get() !== "false";

        //     // this.chart = viewSingleRegion(data, this.singleregion, multi, limit);
        // }.bind(this));

    };


    var startRequests = function startRequests() {
        if (this.torequest.length === 0) {
            return;
        }
        var elem = this.torequest.shift();
        drawVm.call(this, elem.region, elem.id);
    };


    var drawRegion = function drawRegion(region) {
        var newurl = url + region + "/vms";

        FIDASHRequests.get(newurl, function (err, data) {
            if (err) {
                window.console.log(err);
                MashupPlatform.widget.log("The API seems down (Vms from region " + region + " ): " + err.statusText);

                return;
            }

            var startR = this.torequest.length === 0;

            // Data is a list of vms, let's do one request by vm
            var vms = [];
            data.vms.forEach(function (x) {
                if (!!x.id && x.id !== "None") {
                    vms.push(x.id);
                    this.torequest.push({region: region, id: x.id});
                }
            }.bind(this));

            this.vmsByRegion[region] = vms;

            if (startR) {
                startRequests.call(this);
            }

        }.bind(this));
    };

    var removeRegion = function removeRegion(region) {
        $("#" + region).remove();
        this.torequest = this.torequest.filter(function (x) {
            return x.region !== region;
        });

        if (this.singleregion === region) {
            this.singleregion = "";
            this.singlevm = "";
        }
    };

    var drawRegions = function drawRegions(regions) {
        // diff and only get news, and remove/hide unselected?
        if (regions.length > this.last_regions.length) {
            // add
            diffArrays(regions, this.last_regions)
                .forEach(drawRegion.bind(this));
        } else if (regions.length < this.last_regions.length) {
            // remove
            diffArrays(this.last_regions, regions)
                .forEach(removeRegion.bind(this));
        }

        this.variables.regionSelected.set(regions.join(","));
        this.last_regions = regions;
    };

    var fillRegionSelector = function fillRegionSelector(regions) {
        regions.forEach(function (region) {
            $("<option>")
                .val(region)
                .text(region)
                .appendTo($("#region_selector"));
        });

        $("#region_selector").prop("disabled", false);
        $("#region_selector").selectpicker({ title: "Choose regions" });
        $("#region_selector").selectpicker("refresh");
    };

    var selectSavedRegions = function selectSavedRegions() {
        // Get regions
        var regionsS = this.variables.regionSelected.get();
        var regions = regionsS.split(",");
        receiveRegions.call(this, JSON.stringify(regions));
    };

    var loadRegions = function loadRegions () {
        const options = {
            method: "GET",
            requestHeaders: {
                "X-FI-WARE-OAuth-Token": "true",
                "X-FI-WARE-OAuth-Header-Name": "X-Auth-Token",
                Accept: "application/json"
            },
            onSuccess: response => {
                const data = JSON.parse(response.response);

                var regions = [];

                data._embedded.regions.forEach(function (region) {
                    regions.push(region.id);
                    downloadingData[region.id] = {};
                    this.fulldata[region.id] = this.fulldata[region.id] || {};
                }.bind(this));

                // const regions = data.Infrastructures.map(x => x.name);

                fillRegionSelector(regions.sort());
                selectSavedRegions.call(this);
                this.regions = $("#region_selector").val() || [];
            },
            onFailure: err => {
                MashupPlatform.widget.log(err);
            }
        };
        MashupPlatform.http.makeRequest(`${url}`, options);
    };

    var handleAmChartZoom = function handleAmChartZoom(event) {
        if (!this.init) {
            this.startDate = event.startDate;
            this.endDate = event.endDate;
        }
    };

    var handleAmChartInit = function handleAmChartInit(event) {
        if (this.init && this.startDate && this.endDate) {
            setTimeout(function () {
                this.init = false;
                event.chart.zoom(this.startDate, this.endDate);
            }.bind(this), 100);
        } else {
            this.init = false;
        }
    };


    var drawHorizon = function drawHorizon(fullData, region, width, vm) {
        // const finaldata = data.map((x, i) => [years[i], x]);

        var id = region + "-" + vm;

        var dividedData = fullData.reduce((acc, act) => {
            const dateNumber = +act.date;

            acc[0].push([dateNumber, act.ram]);
            acc[1].push([dateNumber, act.disk]);
            acc[2].push([dateNumber, act.vcpu]);

            return acc;
        }, [[], [], []]),
            ramData = dividedData[0],
            diskData = dividedData[1],
            vcpuData = dividedData[2];

        // const finaldata = data.map((x, i) => [i, x]);

        $("#multiview").append($("<div/>", {
            id: id,
            class: "multidata",
            on: {
                click: function (e) {
                    e.preventDefault();
                    this.singleregion = region;
                    this.singlevm = vm;
                    this.startDate = null;
                    this.endDate = null;
                    viewRegion.call(this);
                }.bind(this)
            }
        }));

        const chart1 = d3.horizon()
                  .width(width)
                  .height(30)
                  .bands(1)
                  .colors([colors.ram, colors.ram, colors.ram, colors.ram])
                  .mode("mirror")
                  .interpolate("basis");

        const chart2 = d3.horizon()
                  .width(width)
                  .height(30)
                  .bands(1)
                  .colors([colors.disk, colors.disk, colors.disk, colors.disk])
                  .mode("mirror")
                  .interpolate("basis");

        const chart3 = d3.horizon()
                  .width(width)
                  .height(30)
                  .bands(1)
                  .colors([colors.vcpu, colors.vcpu, colors.vcpu, colors.vcpu])
                  .mode("mirror")
                  .interpolate("basis");

        $("<div></div>", {class: "regionTitle", text: region + ": " + vm})
            .appendTo($("#" + id));

        $("<div></div>", {class: "dataText", text: "RAM"}).appendTo($("#" + id));
        d3.select("#" + id)
            .append("svg")
            .attr("class", "horizonGraph")
            .attr("width", width)
            .attr("height", 30)
            .data([ramData])
            .call(chart1);

        $("<div></div>", {class: "dataText", text: "VCPU"}).appendTo($("#" + id));
        d3.select("#" + id)
            .append("svg")
            .attr("class", "horizonGraph")
            .attr("width", width)
            .attr("height", 30)
            .data([vcpuData])
            .call(chart3);

        $("<div></div>", {class: "dataText", text: "DISK"}).appendTo($("#" + id));
        d3.select("#" + id)
            .append("svg")
            .attr("class", "horizonGraph")
            .attr("width", width)
            .attr("height", 30)
            .data([diskData])
            .call(chart2);



        // svg.data([finaldata]).call(chart);
    };

    var drawAmChart = function drawAmChart(data, region, multiple, limits) {
        // AmCharts.theme = AmCharts.themes.dark;

        var panels = [{
            showCategoryAxis: true, title: region, percentHeight: 100,
            stockGraphs: [{
                id: "g3",
                valueField: "disk",
                type: "smoothedLine",
                balloonText: "DISK: <b>[[value]]</b>",
                lineThickness: 2,
                bullet: "round",
                useDataSetColors: false,
                lineColor: colors.disk,
                fillColors: colors.disk
            }, {
                id: "g1",
                valueField: "ram",
                type: "smoothedLine",
                lineThickness: 2,
                balloonText: "RAM: <b>[[value]]</b>",
                bullet: "round",
                useDataSetColors: false,
                lineColor: colors.ram,
                fillColors: colors.ram
            }, {
                id: "g2",
                valueField: "vcpu",
                type: "smoothedLine",
                balloonText: "VCPU: <b>[[value]]</b>",
                lineThickness: 2,
                bullet: "round",
                useDataSetColors: false,
                lineColor: colors.vcpu,
                fillColors: colors.vcpu
            }],
            stockLegend: { valueTextRegular: " ", markerType: "none" }
        }];

        if (multiple) {
            panels = [{
                "showCategoryAxis": true, "title": "RAM", "percentHeight": 33,
                "stockGraphs": [{
                    "id": "g1",
                    "valueField": "ram",
                    "type": "smoothedLine",
                    "lineThickness": 2,
                    "bullet": "round",
                    useDataSetColors: false,
                    lineColor: colors.ram,
                    fillColors: colors.ram
                }],

                "stockLegend": { "valueTextRegular": " ", "markerType": "none" }
            }, { "showCategoryAxis": true, "title": "VCPU", "percentHeight": 33,
                 "stockGraphs": [{
                     "id": "g2",
                     "valueField": "vcpu",
                     "type": "smoothedLine",
                     "lineThickness": 2,
                     "bullet": "round",
                     useDataSetColors: false,
                     lineColor: colors.vcpu,
                     fillColors: colors.vcpu
                 }],
                 "stockLegend": { "valueTextRegular": " ", "markerType": "none" }
               }, { "showCategoryAxis": true, "title": "DISK", "percentHeight": 33,
                    "stockGraphs": [{
                        "id": "g3",
                        "valueField": "disk",
                        "type": "smoothedLine",
                        "lineThickness": 2,
                        "bullet": "round",
                        useDataSetColors: false,
                        lineColor: colors.disk,
                        fillColors: colors.disk
                    }],
                    "stockLegend": { "valueTextRegular": " ", "markerType": "none" }
                  }];
        }

        var valuesAxes = limits ? {} : { maximum: 1, minimum: 0 };

        AmCharts.theme = AmCharts.theme || AmCharts.themes.light || AmCharts.themes.dark;

        return AmCharts.makeChart("singleview", {
            type: "stock",
            listeners: [
                { event: "zoomed", method: handleAmChartZoom.bind(this)},
                { event: "init", method: handleAmChartInit.bind(this)}
            ],
            theme: "light",
            // height: $(document).height() - 53,

            "responsive": {
                "enabled": true
            },
            // colors: ["#fabada", "#ababab", "#b0de09"],
            categoryAxesSettings: {
                minPeriod: "hh"
            },
            dataSets: [{
                fieldMappings: [{
                    fromField: "disk",
                    toField: "disk"
                }, {
                    fromField: "ram",
                    toField: "ram"
                }, {
                    fromField: "vcpu",
                    toField: "vcpu"
                }],

                dataProvider: data,
                categoryField: "date"
            }],
            valueAxesSettings: valuesAxes,
            panels: panels,
            chartScrollbarSettings: {
                graph: "g1",
                usePeriod: "hh",
                position: "top"
            },

            chartCursorSettings: {
                valueBalloonsEnabled: true,
                fullWidth: true,
                cursorAlpha: 0.1,
                valueLineBalloonEnabled: true,
                valueLineEnabled: true,
                valueLineAlpha: 0.5
            },

            periodSelector: {
                position: "top",
                dateFormat: "YYYY-MM-DD JJ:NN",
                inputFieldWidth: 150,
                periods: [{
                    period: "DD",
                    count: 1,
                    label: "1 day"
                }, {
                    period: "DD",
                    count: 7,
                    label: "1 week"
                }, {
                    period: "MM",
                    count: 1,
                    label: "1 month"
                }, {
                    period: "YYYY",
                    count: 1,
                    label: "1 year",
                    selected: true
                }, {
                    period: "MAX",
                    label: "MAX"
                }]
            },
            export: {
                enabled: true,
                position: "bottom-right",
                menu: [{
                    class: "export-main",
                    label: "Export",
                    menu: ["PNG", "JSON", "XLSX", {label: "Annotate", action: "draw"}, {label: "Print", format: "PRINT"}]
                }]
            }
        });
    };

    var viewSingleRegion = function viewSingleRegion(data, region, multigraph, limits) {
        setTimeout(() => { $("#wizard").easyWizard("nextStep"); }, 0);
        return drawAmChart.call(this, data, region, multigraph, limits);
    };

    var viewRegion = function viewRegion() {
        if (!this.singleregion || !this.singlevm) {
            return;
        }

        var fullData = this.fulldata[this.singleregion][this.singlevm];
        if (!fullData) {
            return;
        }

        if (!!this.chart) {
            // this.chart.clear();
            this.chart = null;
        }

        this.init = true;

        var multi = this.variables.multi.get() !== "false",
            limit = this.variables.limit.get() !== "false";

        this.chart = viewSingleRegion.call(this, fullData, this.singleregion + " - " + this.singlevm, multi, limit);
    };

    var getVmData = function getVmData(region, vm, next, nexterror) {
        const rurl = url + region + "/vms/" + vm;
        next = next || function () {};
        nexterror = nexterror || function () {};
        const options = {
            method: "GET",
            parameters: {
                since: "2000-05-04T00:00"
            },
            requestHeaders: {
                "X-FI-WARE-OAuth-Token": "true",
                "X-FI-WARE-OAuth-Header-Name": "X-Auth-Token",
                // "X-Auth-Token-KeyStone": token,
                Accept: "application/json"
            },
            onSuccess: response => {
                const Jresponse = JSON.parse(response.response);

                const measures = Jresponse.measures || [];
                const fullData = [];
                // const data = [];
                // const years = [];

                measures.forEach(d => {
                    // var coresused = d.nb_cores_used || d.nb_cores_enabled;
                    // var cores = d.nb_cores || d.nb_cores_tot;
                    // var cpuallocation = d.cpu_allocation_ratio || 16;
                    // years.push(+(new Date(d.timestamp)));
                    // data.push(d.percRAMUsed);
                    fullData.push({
                        date: new Date(d.timestamp),
                        ram: d.percRAMUsed || 0.0,
                        disk: d.percDiskUsed || 0.0,
                        vcpu: d.percCPULoad || 0.0 // (coresused / (cores * cpuallocation)) || 0.0
                    });

                    // const cpuall = d.cpu_allocation_ratio || 16;
                    // data.push(d.nb_cores_used / (d.nb_cores * cpuall));
                });

                const fixedData = fixData(fullData, new Date(fullData[0].date), new Date(fullData[fullData.length - 1].date));

                this.fulldata[region][vm] = fixedData;

                next(fixedData, region);
            },
            onFailure: err => {
                nexterror(err);
            },
            onComplete: function () {
                downloadingData[region][vm] = false;
            }
        };

        downloadingData[region][vm] = true;
        MashupPlatform.http.makeRequest(rurl, options);
    };


    // var getRegionData = function getRegionData(region, next) {
    //     const rurl = url + region;
    //     next = next || function () {};
    //     const options = {
    //         method: "GET",
    //         parameters: {
    //             since: "2000-05-04T00:00"
    //         },
    //         requestHeaders: {
    //             "X-FI-WARE-OAuth-Token": "true",
    //             "X-FI-WARE-OAuth-Header-Name": "X-Auth-Token",
    //             // "X-Auth-Token-KeyStone": token,
    //             Accept: "application/json"
    //         },
    //         onSuccess: response => {
    //             const Jresponse = JSON.parse(response.response);

    //             const measures = Jresponse.measures || [];
    //             const fullData = [];
    //             // const data = [];
    //             // const years = [];

    //             measures.forEach(d => {
    //                 var coresused = d.nb_cores_used || d.nb_cores_enabled;
    //                 var cores = d.nb_cores || d.nb_cores_tot;
    //                 var cpuallocation = d.cpu_allocation_ratio || 16;
    //                 // years.push(+(new Date(d.timestamp)));
    //                 // data.push(d.percRAMUsed);
    //                 fullData.push({
    //                     date: new Date(d.timestamp),
    //                     ram: d.percRAMUsed || 0.0,
    //                     disk: d.percDiskUsed || 0.0,
    //                     vcpu: (coresused / (cores * cpuallocation)) || 0.0
    //                 });

    //                 // const cpuall = d.cpu_allocation_ratio || 16;
    //                 // data.push(d.nb_cores_used / (d.nb_cores * cpuall));
    //             });

    //             const fixedData = fixData(fullData, new Date(fullData[0].date), new Date(fullData[fullData.length - 1].date));

    //             this.fulldata[region] = fixedData;

    //             next(fixedData, region);

    //             // drawAmChart.call(this, fullData, region, this.multigraph);
    //             // drawHorizon(data, width);

    //             // // Enable mode buttons.
    //             // d3.selectAll("#horizon-controls input[name=mode]").on("change", function () {
    //             //     svg.call(chart.duration(0).mode(this.value));
    //             // });

    //             // // Enable bands buttons.
    //             // d3.selectAll("#horizon-bands button").data([-1, 1]).on("click", function (d) {
    //             //     var n = Math.max(1, chart.bands() + d);
    //             //     d3.select("#horizon-bands-value").text(n);
    //             //     svg.call(chart.duration(1000).bands(n).height(30 / n));
    //             // });
    //         },
    //         onError: err => {
    //             MashupPlatform.widget.log(err);
    //         },
    //         onComplete: function () {
    //             downloadingData[region] = false;
    //         }
    //     };

    //     downloadingData[region] = true;
    //     MashupPlatform.http.makeRequest(rurl, options);
    // };

    var incrementHoursDate = function incrementHoursDate(date, n) {
        date.setTime(date.getTime() + (n * 60 * 60 * 1000));
    };

    var dateInRange = function dateInRange(date1, date2, date3) {
        return date1 >= date2 && date1 < date3;
    };

    var fixData = function fixData(data, startDate, endDate) {
        var empty = function empty(date) {
            return {
                // date: new Date(date.getTime()).toISOString(),
                date: new Date(date.getTime()),
                ram: 0.0,
                disk: 0.0,
                vcpu: 0.0
            };
        };

        startDate = new Date(startDate.getTime());
        var i = 0;
        var newdata = [];
        while (startDate <= endDate) {
            if (i >= data.length) {
                newdata.push(empty(startDate));
                incrementHoursDate(startDate, 1);
                continue;
            }

            var element = data[i];
            var compareTime = new Date(startDate.getTime() + (60 * 60 * 1000));

            if (dateInRange(new Date(element.date), startDate, compareTime)) {
                newdata.push(element);
                i++;
            } else {
                newdata.push(empty(startDate));
            }

            incrementHoursDate(startDate, 1);
        }

        return newdata;
    };

    var debouncer = function debouncer(func, timeout) {
        var timeoutID , newtimeout = timeout || 200;
        return function () {
            var scope = this , args = arguments;
            clearTimeout(timeoutID);
            timeoutID = setTimeout(function () {
                func.apply(scope , Array.prototype.slice.call(args));
            } , newtimeout);
        };
    };

    var getAllOptions = function getAllOptions() {
        return $("#region_selector option").map(function (x, y) {
            return $(y).text();
        }).toArray();
    };

    var filterNotRegion = function filterNotRegion(regions) {
        var ops = getAllOptions();
        return regions.filter(function (i) {
            return ops.indexOf(i) >= 0;
        });
    };

    var receiveRegions = function receiveRegions(regionsRaw) {
        var regions = JSON.parse(regionsRaw);

        // Check it's a list
        var newRegions = filterNotRegion(regions);

        // Set in selector
        $("#region_selector").selectpicker("val", newRegions);

        this.regions = newRegions;
        this.last_regions = []; // Reset regions! :)
        // Empty before override
        $("#multiview").empty();
        drawRegions.call(this, this.regions);
    };

    var setHandlers = function setHandlers() {
        var $this = this;

        // MashupPlatform.wiring.registerCallback("authentication", paramsraw => {
        //     const params = JSON.parse(paramsraw);
        //     const token = params.token;

        //     if (token === this.token) {
        //         return;
        //     }

        //     this.token = token;
        // });

        MashupPlatform.wiring.registerCallback("regions", receiveRegions.bind(this));

        var resizeHorizonDebounced = debouncer(function () {
            var regions = $this.fulldata;
            var width = $(document).width();
            for (var region in regions) {
                if (regions.hasOwnProperty(region)) {
                    // for regions, draw vm
                    for (var vm in regions[region]) {
                        if (regions[region].hasOwnProperty(vm)) {
                            // clear
                            $("#" + region + "-" + vm).remove();
                            drawHorizon.call($this, regions[region][vm], region, width, vm);
                        }
                    }
                }
            }
        });

        $(window).resize(function () {
            $("#wizard").easyWizard('resize', $("#wizard").find('.active'));
            resizeHorizonDebounced();
        });

        $("#previousStep").click(e => {
            e.preventDefault();
            $("#wizard").easyWizard("prevStep");
        });

        $("#nextStep").click(e => {
            e.preventDefault();
            if ($this.singleregion !== "" && $this.singlevm !== "") {
                $("#wizard").easyWizard("nextStep");
            }
        });

        $("input[type='checkbox']").on("switchChange.bootstrapSwitch", function (e, data) {
            var type = e.target.dataset.onText;
            type = type.toLowerCase();

            if (type === "multi" || type === "single") {
                // multi
                MashupPlatform.widget.getVariable("multi").set("" + data);
            } else {
                // limit
                MashupPlatform.widget.getVariable("limit").set("" + data);
            }

            viewRegion.call($this);
        }.bind(this));

        // $("#multiswitch").prop("checked", this.variables.multi.get() !== "false");
        // $("#multiswitch").change(function () {
        //     MashupPlatform.widget.getVariable("multi").set("" + $(this).is(":checked"));
        //     viewRegion.call($this);
        // });

        // $("#limitswitch").prop("checked", this.variables.limit.get() !== "false");
        // $("#limitswitch").change(function () {
        //     MashupPlatform.widget.getVariable("limit").set("" + $(this).is(":checked"));
        //     viewRegion.call($this);
        // });

        $("#region_selector").change(function () {
            this.regions = $("#region_selector").val() || [];
            this.last_regions = this.last_regions || [];
            drawRegions.call(this, this.regions);
        }.bind(this));
    };

    var handleVariables = function handleVariables() {
        // hide?
        if (MashupPlatform.widget.getVariable("multi").get() !== "true") {
            $("#multiswitch input[name='select-charts-region']").bootstrapSwitch("state", false, true);
        }

        if (MashupPlatform.widget.getVariable("limit").get() !== "true") {
            $("#limitswitch input[name='select-charts-region']").bootstrapSwitch("state", false, true);
        }
    };


    // var cubismChart = function cubismChart() {
    //     const context = cubism.context()
    //               .serverDelay(Date.now() - new Date(2016, 2, 7))
    //               .step(60 * 60 * 1000) // one hour per value
    //               .size(1080)
    //               .stop();

    //     this.context = context;

    //     d3.select("#multiview").selectAll(".axis")
    //         .data(["top", "bottom"])
    //         .enter().append("div")
    //         .attr("class", function (d) {
    //             return d + " axis";
    //         })
    //         .each(function (d) {
    //             d3.select(this).call(context.axis().ticks(12).orient(d));
    //         });

    //     d3.select("#multiview").append("div")
    //         .attr("class", "rule")
    //         .call(context.rule());

    //     context.on("focus", function (i) {
    //         d3.selectAll(".value").style("right", i == null ? null : context.size() - i + "px");
    //     });

    //     startHorizons.call(this);
    // };

    // var monitoringMetric = function (region) {
    //     const context = this.context;
    //     const token = this.token;

    //     // YYYY-MM-DDTHH:MM

    //     return context.metric(function (start, stop, step, callback) {
    //         const rurl = url + region;
    //         const options = {
    //             method: "GET",
    //             parameters: {
    //                 since: "2015-05-04T00:00"
    //             },
    //             requestHeaders: {
    //                 "X-FI-WARE-OAuth-Token": "true",
    //                 "X-FI-WARE-OAuth-Header-Name": "X-Auth-Token",
    //                 "X-Auth-Token-KeyStone": token,
    //                 Accept: "application/json"
    //             },
    //             onSuccess: response => {
    //                 const Jresponse = JSON.parse(response.response);

    //                 const measures = Jresponse.measures || [];
    //                 const data = [];

    //                 measures.forEach(d => {
    //                     data.push(d.percRAMUsed || NaN);
    //                     // const cpuall = d.cpu_allocation_ratio || 16;
    //                     // data.push(d.nb_cores_used / (d.nb_cores * cpuall));
    //                 });
    //                 callback(null, data.slice(-context.size()));
    //             },
    //             onError: err => {
    //                 callback(err);
    //             }
    //         };

    //         MashupPlatform.http.makeRequest(rurl, options);
    //     }, region);
    // };

    // var startHorizons = function startHorizons() {
    //     d3.select("#multiview").selectAll(".horizon")
    //         .data(["Lannion2"].map(monitoringMetric.bind(this)))
    //         .enter().insert("div", ".bottom")
    //         .attr("class", "horizon")
    //         .call(this.context.horizon()
    //               .format(d3.format("+,.2p")));
    // };


    /****************************************/
    /************AUXILIAR FUNCTIONS**********/
    /****************************************/


    return WidgetHistoricalVms;

})();
