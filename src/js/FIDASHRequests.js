/*
 * FIDASHRequests.js
 *
 * Copyright (c) 2016 Rock Neurotiko
 * Licensed under the BeerWare license.
 */

/*exported FIDASHRequests*/
var FIDASHRequests = (function () {
    "use strict";
    // http://stackoverflow.com/questions/1714786/querystring-encoding-of-a-javascript-object
    var serialize = function serialize(obj) {
        var str = [];
        for (var p in obj) {
            if (obj.hasOwnProperty(p)) {
                str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
            }
        }
        return str.join("&");
    };

    // Let's use the Node-like callbacks: err -> data -> IO ()
    var genericReq = function genericReq(method, url, data, callback) {
        if (!MashupPlatform) {
            callback("No MashupPlatform detected");
            return;
        }

        callback = callback || function () {};
        method = method.toUpperCase();

        var requestOps = {
            method: method,
            requestHeaders: {
                "X-FI-WARE-OAuth-Token": "true",
                "X-FI-WARE-OAuth-Header-Name": "X-Auth-Token"
            },
            onSuccess: function (response) {
                var data = JSON.parse(response.responseText);
                callback(null, data);
            },
            onFailure: function (response) {
                callback(response);
            }
        };

        if (!!data) { // if there are any data
            var isDataStr = typeof data === "string";
            if (method === "GET") { // encode in url
                url = url + "?" + (isDataStr) ? data : serialize(data);
            } else if (method === "POST") { // encode as string
                requestOps.body = (isDataStr) ? data : JSON.stringify(data);
                requestOps.contentType = "application/json";
            }
        }

        if (MashupPlatform.context.get('fiware_token_available')) {
            MashupPlatform.http.makeRequest(url, requestOps);
        } else {
            callback("No fiware token available");
        }
    };

    var get = function get(url, data, callback) {
        // No callback but data exists, means thet get has been called only with (url, callback)
        if (!callback && !!data) {
            callback = data;
            data = null;
        }
        genericReq("GET", url, data, callback);
    };

    var post = function post(url, data, callback) {
        genericReq("POST", url, data, callback);
    };

    return {
        get: get,
        post: post
    };
})();
