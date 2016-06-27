/*global $, MashupPlatform, MockMP, WidgetHistoricalregions, beforeAll, afterAll, beforeEach*/
(function () {
    "use strict";

    jasmine.getFixtures().fixturesPath = 'src/test/fixtures/';

    var dependencyList = [
        'script',
        'div',
    ];

    var clearDocument = function clearDocument() {
        $('body > *:not(' + dependencyList.join(', ') + ')').remove();
    };

    describe("Test WidgetHistoricalregions", function () {
        var widget;
        beforeAll(function () {
            window.MashupPlatform = new MockMP();
        });

        beforeEach(function () {
            MashupPlatform.reset();
            // widget = new WidgetHistoricalregions();
        });

        it("Dummy test", function () {
            expect(true).toBeTruthy();
        });

    });
})();
