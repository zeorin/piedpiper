// Start up server.
var io = require('socket.io').listen(3128);

// Set some pied piper settings.
var config = {
	interval: 500	// Time interval between repeat broadcasts
};

// When we receive a tune, broadcast it continually in case of connectivity issues.
var receiveTune = (function () {

	// Define some top-scope variables.
	var interval = {
		location: '',
		page_scroll: '',
		event: ''
	};
	var cached_tune = {
		location: '',
		page_scroll: '',
		event: ''
	};

	return function (tune, socket) {

		// There are three tune types: location, page_scroll, and all others (event)
		switch (tune.type) {

			case 'location':
				cached_tune.location = tune;
				console.log('location tune received from client ' + socket.id + ', broadcasting to all other clients: ' + cached_tune.location.content);
				cached_tune.location.time_stamp = Date.now();
				// Stop broadcast of location and page_scroll and events
				clearInterval(interval.location);
				clearInterval(interval.page_scroll);
				clearInterval(interval.event);
				// New broadcast
				interval.location = setInterval(function () {
					socket.broadcast.emit('tune', cached_tune.location);
				}, config.interval);
				break;

			case 'page_scroll':
				cached_tune.page_scroll = tune;
				console.log('page_scroll tune received from client ' + socket.id + ', broadcasting to all other clients: ' + cached_tune.page_scroll.content);
				cached_tune.page_scroll.time_stamp = Date.now();
				// Stop broadcast
				clearInterval(interval.page_scroll);
				// New broadcast
				interval.page_scroll = setInterval(function () {
					socket.broadcast.emit('tune', cached_tune.page_scroll);
				}, config.interval);
				break;

			default:
				cached_tune.event = tune;
				console.log('event tune (type: ' + cached_tune.event.type + ') received from client ' + socket.id + ', broadcasting to all other clients: ' + cached_tune.event.content);
				cached_tune.event.time_stamp = Date.now();
				// Stop broadcast
				clearInterval(interval.event);
				// New broadcast
				interval.event = setInterval(function () {
					socket.broadcast.emit('tune', cached_tune.event);
				}, config.interval);
				break;
		}

	};

})();


io.configure(function () {
	io.set('log level', 0);
});

io.sockets.on('connection', function (socket) {
	
	console.log('connect from client: ' + socket.id);
	socket.emit('clientid', socket.id);
	
	socket.on('tune', function (tune) {
		receiveTune(tune, socket);
	});
	socket.on('message', function (msg) {
		console.log('message received from client, broadcasting to all other clients: ' + msg);
		socket.broadcast.send(msg);
	});
});
