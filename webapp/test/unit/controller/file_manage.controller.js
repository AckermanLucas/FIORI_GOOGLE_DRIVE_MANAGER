/*global QUnit*/

sap.ui.define([
	"com/saperp/fiori/filedrivemanage/controller/file_manage.controller"
], function (Controller) {
	"use strict";

	QUnit.module("file_manage Controller");

	QUnit.test("I should test the file_manage controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
