/* global $CC, Utils, $SD */

$SD.on('connected', (jsonObj) => connected(jsonObj));

function connected(jsn) {
	$SD.on('com.roguedarkjedi.dogcam.reset.keyDown', (jsonObj) => action.onKeyDown(jsonObj));
	$SD.on('com.roguedarkjedi.dogcam.up.keyDown', (jsonObj) => action.onKeyDown(jsonObj));
	$SD.on('com.roguedarkjedi.dogcam.down.keyDown', (jsonObj) => action.onKeyDown(jsonObj));
	$SD.on('com.roguedarkjedi.dogcam.left.keyDown', (jsonObj) => action.onKeyDown(jsonObj));
	$SD.on('com.roguedarkjedi.dogcam.right.keyDown', (jsonObj) => action.onKeyDown(jsonObj));
	
	// TODO: Make global settings
	$SD.on('com.roguedarkjedi.dogcam.reset.willAppear', (jsonObj) => action.onWillAppear(jsonObj));
	$SD.on('com.roguedarkjedi.dogcam.reset.didReceiveSettings', (jsonObj) => action.onDidReceiveSettings(jsonObj));
	
	$SD.on('applicationDidLaunch', (jsonObj) => action.onApplicationStarted(jsonObj));
	$SD.on('applicationDidTerminate', (jsonObj) => action.onApplicationExit(jsonObj));
	$SD.on('com.roguedarkjedi.dogcam.reset.sendToPlugin', (jsonObj) => action.onSendToPlugin(jsonObj));
};

/** ACTIONS */

const action = {
	settings:{},
	websocket: null,
	resetContext: "",
	applicationRunning: false,
	
	startDogcamConnect: function() {
		if (this.websocket != null) {
			console.log("Connect was called but we are already connected!");
			return;
		}
		this.websocket = new WebSocket("ws://"+this.settings["websocketaddr"]+"/");
		this.websocket.onopen = function(event) {
			console.log("Dogcam Connection established");
		};
		this.websocket.onmessage = function(msg) {
			console.log("Dogcam Got message "+msg);
		};
		this.websocket.onerror = function(msg) {
			console.log("Dogcam ERROR " + msg);
			$SD.api.showAlert(action.resetContext);
			action.websocket = null;
		};
	},
	
	exitDogcam: function() {
		// Don't kill the websocket if OBS gets restarted
		if (this.applicationRunning) {
			return;
		}
		
		if (this.websocket != null) {
			console.log("Closing the dogcam connection");
			this.websocket.close(1000, "done");
		}
		this.websocket = null;
	},
	
	onApplicationStarted: function(jsn) {
		this.applicationRunning = true;
		
		if (Object.keys(this.settings).length === 0) {
			console.log("Missing settings to connect to dogcam!");
			return;
		}
		
		console.log("Starting countdown for connection to dogcam");
		setTimeout(this.startDogcamConnect, 20000);
	},
	
	onApplicationExit: function(jsn) {
		this.applicationRunning = false;
		setTimeout(this.exitDogcam, 15000);
	},
	
	onDidReceiveSettings: function(jsn) {
		console.log('%c%s', 'color: white; background: red; font-size: 15px;', '[app.js]onDidReceiveSettings:');

		this.settings = Utils.getProp(jsn, 'payload.settings', {});
	},

	onKeyDown: function (jsn) {
		var angularDirection = 1.0;
		var moveType = "moverel";
		
		if (this.settings) {
			if (this.settings.hasOwnProperty('degreestep')) {
				angularDirection = this.settings["degreestep"];
			}
			if (this.settings.hasOwnProperty('movemethod')) {
				moveType = this.settings["movemethod"];
			}
		}
		
		if (this.websocket == null) {
			console.log("Dropping push down event as the websocket is not valid at this time");
			return;
		}

		var actionType = jsn.action.replace("com.roguedarkjedi.dogcam.", "");
		switch (actionType) {
		case "up":
			this.websocket.send('{"servo": "tilt", "action": "'+moveType+'", "angle": '+angularDirection+'}');
			break;
		case "down":
			this.websocket.send('{"servo": "tilt", "action": "'+moveType+'", "angle": -'+angularDirection+'}');
			break;
		case "left":
			this.websocket.send('{"servo": "pan", "action": "'+moveType+'", "angle": -'+angularDirection+'}');
			break;
		case "right":
			this.websocket.send('{"servo": "pan", "action": "'+moveType+'", "angle": '+angularDirection+'}');
			break;
		case "reset":
			this.websocket.send('{"servo": "tilt", "action": "resetall"}');
			$SD.api.showOk(jsn.context);
			break;
		default:
			console.log("Action type: "+actionType+" is not recognized!");
		}
	},
	
	onWillAppear: function(jsn) {
		// Save this context value
		this.resetContext = jsn.context;
	},

	onSendToPlugin: function (jsn) {
		/**
		* this is a message sent directly from the Property Inspector 
		* (e.g. some value, which is not saved to settings) 
		* You can send this event from Property Inspector (see there for an example)
		*/ 

		const sdpi_collection = Utils.getProp(jsn, 'payload.sdpi_collection', {});
		if (sdpi_collection.value && sdpi_collection.value !== undefined) {
			this.startDogcamConnect();
		}
	},

	/**
	* This snippet shows, how you could save settings persistantly to Stream Deck software
	* It is not used in this example plugin.
	*/

	saveSettings: function (jsn, sdpi_collection) {
		console.log('saveSettings:', jsn);
		if (sdpi_collection != null && sdpi_collection.hasOwnProperty('key') && sdpi_collection.key != '') {
			if (sdpi_collection.value && sdpi_collection.value !== undefined) {
				this.settings[sdpi_collection.key] = sdpi_collection.value;
				console.log('setSettings....', this.settings);
				$SD.api.setSettings(jsn.context, this.settings);
			}
		}
		else {
			$SD.api.setSettings(jsn.context, this.settings);
		}
	}
};

