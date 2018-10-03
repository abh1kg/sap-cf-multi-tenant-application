sap.ui.define([
	"sap/ui/core/mvc/Controller"
], function (Controller) {
	"use strict";

	return Controller.extend("inventorymanagementui.inventorymanagementui.controller.landingHome", {
		onInit: function () {
			var userInfoModel = new JSONModel();
			this.getView().setModel(userInfoModel, "user");

			this.getUserInfo();

			var oRouter = this.getOwnerComponent().getRouter();
			oRouter.getRoute("landingHome").attachMatched(this.onRouteMatched, this);
		},

		onRouteMatched: function () {
			this.getUserInfo();
		},

		getUserInfo: function () {
			var controller = this;
			var url = '/inventorymanagementbackend/dbtask/userInfo';
			controller.getView().setBusy(true); // Starts a loading animation

			jQuery
				.ajax({
					url: url, // Get tenant specific products url
					type: "GET", // Request type - Get
					dataType: "json", // Return datatype
					headers: {
						'x-csrf-token': 'fetch' // Fetch CSRF token header
					},
					complete: function (xhr) {
						sap.ui.getCore().AppContext.token = xhr.getResponseHeader("x-csrf-token"); // Set the CSRF token to a global context
					},
					success: function (response) {
						// API call was successful
						console.log(response);
						controller.getView().getModel("user").setData(response); // Set the response data to the products model (Which is used by the UI)
						controller.getView().setBusy(false); // Stops the loading animation
					},
					error: function (e) {
						// API call failed
						console.log(e.message);
						controller.getView().setBusy(false); // Stops the loading animation
					}
				});
		}

	});

});