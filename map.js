// OpenLayers 3 - Test with mapserver for B-CGMS - Julien Minet - July 2016. 

mapboxgl.accessToken = 'pk.eyJ1Ijoic2FtZ2FydHJlbGwiLCJhIjoiY2w3OWt3MW00MDNjbDN2cGRpc20ya3JnbyJ9.6t2ISNlyP1BvBmkSH2Ks_Q';
var map = new mapboxgl.Map({
    container: 'map', // pointing to the above "map" div
    style: 'mapbox://styles/samgartrell/cl7tnbdlk000215qdvkret4rv',
    center: [-123.0868, 44.0521],
    zoom: 8
});

// Data for Map points:
// actual endpoint (started working...?)
var endpoint = `https://waterservices.usgs.gov/nwis/iv/?format=json&indent=on&stateCd=or&${formatDateStamp(0)}&parameterCd=00060&siteStatus=active`
console.log(endpoint)
// // local file endpoint, copied from the rest API response in browser (works)
// var local = './data/0.json'

// send api request
fetch(endpoint)
    .then(response => response.json())
    .then(data => {

        // get data body
        var gauges = data.value.timeSeries;

        // set a counter and limit for testing
        let counter = 0;
        let limit = 999;

        // iterate through locations, adding each one to the map
        gauges.forEach(function (gauge) {
            counter++;
            if (counter <= limit) {

                // make a little gauge object "g" for better readability
                g = {
                    'lat': gauge.sourceInfo.geoLocation.geogLocation.latitude,
                    'lon': gauge.sourceInfo.geoLocation.geogLocation.longitude,
                    'title': formatTitleCase(gauge.sourceInfo.siteName),
                    'id': gauge.sourceInfo.siteCode[0].value,
                    'data': {
                        'value': gauge.values[0].value[0].value,
                        'time': gauge.values[0].value[0].dateTime,
                        'desc': gauge.variable.variableDescription,
                        'unit': gauge.variable.unit.unitcode
                    }
                };

                // create a popup
                // TODO: put info like this next to the graph and think of a cool css way to have the cards balanced on mobile etc
                // let popup = new mapboxgl.Popup(
                //     { closeOnClick: true, focusAfterOpen: false }
                // ).setHTML(`<h2>${g.title}</h2>
                //             <p>${g.data.desc}: ${g.data.value}</p>
                //             <br>
                //             <a href=https://waterdata.usgs.gov/monitoring-location/${g.id}/#parameterCode=00060&period=P7D>updated at ${g.data.time}</a>`
                // );

                // create a DOM element for each marker (this is how icons are styled)
                const el = document.createElement('div');
                el.className = 'marker';
                el.style.backgroundImage = `url(./img/semi.svg)`;
                el.style.width = `20px`;
                el.style.height = `20px`;
                el.style.backgroundSize = '100%';

                // create the Mapbox marker object and add it to the map
                let marker = new mapboxgl.Marker(el)
                    .setLngLat([g.lon, g.lat])
                    .addTo(map)
                    // .setPopup(popup)

                let element = marker.getElement()
                element.setAttribute('siteid', `${g.id}`)
                element.setAttribute(
                    'onClick', "passID(this)"
                )
            }
        }
        )
    }
    );

// retrieve data for last 7 days and restructure to be ingestible by renderChart()
// an array of promises is also returned, in case the requests are still executing
// eventually, put this in a timeout loop that runs every hour or something
structuredData = retrieveData()
console.log(structuredData)

// CHART
const chartEl = document.getElementById('line-canvas')

// Options for the observer (which mutations to observe)
const config = { attributes: true, childList: false, subtree: false };

// Callback function to execute when mutations are observed
const callback = (mutationList, observer) => {
    for (const mutation of mutationList) {
        // only fire if the mutation concerns "siteid"
        if (mutation.type === "attributes" && mutation.attributeName === "siteid") {
            let siteId = mutation.target.getAttribute("siteid")
            try {
                if (chrt != undefined) {
                    chrt.destroy(); // without this, the charts persist and jump back and forth on hover
                }
            } catch {
                ReferenceError
            } finally {
                if (structuredData[siteId] != undefined) {
                    chrt = renderChart(chartEl, structuredData[siteId]);
                } else {
                    console.log('7 day history unavailable for this location')
                    //chart current values or something
                }
            }

        }
    }
};

// Create an observer instance linked to the callback function
const observer = new MutationObserver(callback);

// Start observing the target node for configured mutations
observer.observe(chartEl, config);

// observer.disconnect();

// FUNCS:
function formatDateStamp(daysAgo, hrWindow = 1) {
    // get/freeze now 
    // (make it an hour ago just so data is guaranteed to have been transmitted to USGS db in last hr, if daysAgo=0)
    const now = new Date(Date.now() - 4 * 60 * 60 * 1000);

    // set start date to now - (number of days ago we're targeting * day length in ms)
    const end = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

    // set end date to start date - number of hours of observations we want in ms
    const start = new Date(end - hrWindow * 60 * 60 * 1000);

    // format the string like startDT=2023-04-20T11:18-0700&endDT=2023-04-20T12:18-0700
    return `startDT=${start.toISOString()}&endDT=${end.toISOString()}`;
}

// color markers based on stream depth
function getMarkerColor(attributes) {
    if (attributes.depth < 2) {
        return 'green';
    } else if (attributes.depth < 4) {
        return 'yellow';
    } else {
        return 'red';
    }
};

// pass ID to chart element
function passID(e, chartEl = document.getElementById('line-canvas')) {
    id = e.getAttribute('siteid')
    chartEl.setAttribute('siteid', id)
    console.log(id)
};


// panel selection function. opens or closes the panel (manipulates css height prop) depending on its current state, when clicked.
// changes the icon! points the glyph at one of two chevrons
function panelSelect(e) {
    console.log(e) //note that "e" represents the 
    //               ELEMENT in which this function was called, 
    //               since we put "this" inside the () when
    //               calling the funciton
    if (state.panelOpen) {
        document.getElementById('chartPanel').style.height = '40px';
        document.getElementById('chartPanel').style.width = '40px';
        document.getElementById('chartPanel').style.bottom = '5%';
        document.getElementById('glyph').className = "chevron glyphicon glyphicon-chevron-up";
        document.getElementById('closer').style.height = "0px";
        document.getElementById('closer').style.width = "0px";
        state.panelOpen = false;
    } else {
        document.getElementById('chartPanel').style.height = '250px';
        document.getElementById('chartPanel').style.width = '90%';
        document.getElementById('chartPanel').style.bottom = '10%';
        document.getElementById('glyph').className = "chevron glyphicon glyphicon-chevron-down";
        document.getElementById('closer').style.height = "26px";
        document.getElementById('closer').style.width = "26px";
        state.panelOpen = true;
    }
    console.log(state)
}

function retrieveData() {
    /*
    Function to retrieve flow data for all stream gauges for the last 7 days, 
    then restructure the result into an object to be parsed by the graph function 
    Courtesy of ChatGPT.
    */

    const days = ['today', 'yesterday', '2daysago', '3daysago', '4daysago', '5daysago', '6daysago']; // this code is whack
    const results = {};

    // Create an array of promises
    const promises = days.map((day, i) => {
        const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&indent=on&stateCd=or&${formatDateStamp(i)}&parameterCd=00060&siteStatus=active`; // eventually, manipulate this code to make actual requests. starting with 0 days ago (not 1, as here)
        return fetch(url).then(response => response.json());
    });

    // Wait for all promises to resolve before continuing
    Promise.all(promises).then(data => {
        data.forEach(json => {
            const timeSeries = json.value.timeSeries;
            for (let j = 0; j < timeSeries.length; j++) {
                const siteCode = timeSeries[j].sourceInfo.siteCode[0].value;
                const siteName = timeSeries[j].sourceInfo.siteName;

                if (!results[siteCode]) {
                    results[siteCode] = {
                        name: siteName,
                        readings: {}
                    };
                }

                const readings = timeSeries[j].values[0].value.map(v => parseFloat(v.value));
                const index = data.indexOf(json) + 1;
                results[siteCode].readings[index] = readings;
            }
        });

    }).catch(error => {
        console.error(error);
    });
    return results
}

function renderChart(e, siteData) {
    const colors = {
        'neutral': {
            'light': 'rgba(255, 255, 255, 0.1)',
            'dark': 'rgb(30,33,40)',
            'bright': 'rgba(255, 255, 255, .7)'
        },
        'theme': {
            'blue': '#1CD6D9',
            'mutedBlue': 'rgba(28,214,217, .1)'
        }
    }

    // initialize canvas element for chart.js
    var ctx = e.getContext("2d");

    const labels = [
        "last week",
        "6 days ago",
        "5 days ago",
        "4 days ago",
        "3 days ago",
        "yesterday",
        "today",
    ];

    let flowRates = [];

    for (let i = 1; i <= 7; i++) {
        vals = siteData["readings"][i];
        mean = vals.reduce(
            (acc, val) => acc + val, 0
        ) / vals.length;
        flowRates.push(
            Math.round(mean, 0),
        )

    }

    // reverse flow rates to put the sequence of readings in chronological order
    flowRates = flowRates.reverse()

    let data = {
        labels,
        datasets: [{
            data: flowRates,
            label: formatTitleCase(siteData.name),
            fill: true,
            backgroundColor: colors.theme.mutedBlue,
            borderColor: colors.theme.blue,
            pointRadius: 5,
            pointHoverRadius: 10,
            pointHitRadius: -1,

        }]
    };

    let config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            legend: {
                display: false
            },
            scales: {
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'flow (cubic ft/sec)'
                    },
                    ticks: {
                        fontColor: colors.neutral.bright
                    },
                    gridLines: {
                        color: colors.neutral.light
                    }
                }],
                xAxes: [{
                    ticks: {
                        fontColor: colors.neutral.bright
                    },
                    gridLines: {
                        color: colors.neutral.light
                    }
                }]
            },
            title: {
                display: true,
                text: `${formatTitleCase(siteData.name)} | ${flowRates[6]} cf/s`,
                fontColor: colors.neutral.bright
            }
        }
    };

    let myChart = new Chart(ctx, config)

    return myChart
}


function formatTitleCase(str) {
    // this function makes titles more pretty by modifying the case
    const lowerCaseWords = ["near", "at", "in", "above", "below", "by"];
    const words = str.toLowerCase().split(" ");

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (!lowerCaseWords.includes(word)) {
            words[i] = word.charAt(0).toUpperCase() + word.slice(1);
        } else {
            words[i] = word.toLowerCase();
        }
    }

    const result = words.join(" ");

    if (result.toLowerCase().endsWith(", or")) {
        return result.slice(0, -4);
    } else if (result.toLowerCase().endsWith(",or")) {

    } else {
        return result
    }
}

// Add specific classes to OpenLayers elements: hide these controls for mobile view using Bootstrap classes
$('.ol-scale-line').addClass('hidden-xs')
$('.ol-attribution').addClass('hidden-xs')

// Hide/show panel function for desktop view. The panel is shown by default. 
var showPanel = true;
var collapsePanel = function(){
	if(showPanel === true){
	  $('div#panel').css('width','35px');
	  $('div#panelContent').css('opacity','0' );
	  $('div#collapseBtn button').text('>');
	  showPanel =! showPanel;
	  }
   else{
	  $('div#panel').css('width','300px');
	  $('div#panelContent').css('opacity','1');
	  $('div#collapseBtn button').text('<');
	  showPanel =! showPanel;
	  }
}

// Hide/show panel function for mobile view. The panel is not shown by default.
var showPanelXs = false;
var collapsePanelXs = function(){
	if(showPanelXs === true){
	  $('div#panel').css('width','0px');
	  $('div#panelContent').css('opacity','0' );
	  showPanelXs =! showPanelXs;
	  }
   else{
     $('div#panel').css('width','calc(100% - 45px)');
     $('div#panelContent').css('opacity','1');
     $('div#navbar').removeClass('in')
	  showPanelXs =! showPanelXs;
	  }
}






