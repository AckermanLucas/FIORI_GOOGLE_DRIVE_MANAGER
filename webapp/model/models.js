sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
],
function (JSONModel, Device) {
    "use strict";

    return {
        /**
         * Provides runtime information for the device the UI5 app is running on as a JSONModel.
         * @returns {sap.ui.model.json.JSONModel} The device model.
         */
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },

        createFilesModel: function () {
            return new JSONModel({ items: [] });
        },

        createStatsModel: function () {
            return new JSONModel({
                totalCount: 0, pdfCount: 0, imageCount: 0, otherCount: 0,
                pdfPercent: 0, imagePercent: 0, otherPercent: 0
            });
        },

        createUiModel: function (bDark) {
            return new JSONModel({ dark: bDark, lastSync: "-" });
        }
    };
});

