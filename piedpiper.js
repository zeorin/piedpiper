var piedpiper = (function (io) {

	// Define some top-level variables.
	var socket;
	
	var tune = {
		type: '',	// Type of tune: location, page_scroll, other jQuery events
		content: ''	// The element that was clicked, or in the case of location tune, the destination, or in case of page_scroll, the percentage of the scroll
	};

	var initial_connect_done = false;

	// Set what type of 'tunes' we will communicate to devices.
	var config = {
		socket_io: {
			server: 'piedpiper.opendevicelab',
			port: 3128
		},
		tune_types: {
			location: true,
			page_scroll: true,
			other: true
		}
	};

	// Used to determine whether a signal is new or old.
	var time_stamp = {
		location: Date.now(),
		page_scroll: Date.now(),
		other: Date.now()
	};

	// Actions to take when socket connection is made.
	var _connect = function () {
		// Connect to socket server.
		socket = io.connect('http://' + config.socket_io.server + ':' + config.socket_io.port);

		// Only send out URL on first connect, not on reconnect.
		if (!initial_connect_done) {
			if (config.tune_types.location) {
				tune.type = 'location';
				tune.content = window.location.href;
				_send(tune);
			} else {
				console.log('piedpiper: tune type `location` not permitted by config!');
			}
			initial_connect_done = true;
		}

		// Initiate listeners for page_scroll and jQuery events
		_listen();
		_scrollBind();
	};

	// Set the client id XXX currently the ID is not used yet, might be useful in the future.
	// It may also be more useful to implement socket.io sessions.
	var _setClient = function (client_id) {
		config.socket_io.client_id = client_id;
	};

	// Send 'tune' to socket.io server.
	var _send = function (tune) {
		try {
			socket.emit('tune', tune);
		} catch (e) {
			console.log('piedpiper: could not send tune!');
		}
	};

	// What to do when we receive a 'tune'.
	var _receive = function (tune) {

		// Do different things depending on what type of tune it is
		switch (tune.type) {

			case 'location':
				// Check whether we've already received this message
				if (time_stamp.location < tune.time_stamp) {
					if (tune.content != window.location.href && initial_connect_done) {
						window.location.href = tune.content;
					}
					time_stamp.location = tune.time_stamp;
				}
				break;

			case 'page_scroll':
				// Check whether we've already received this message
				if (time_stamp.page_scroll < tune.time_stamp) {
					time_stamp.page_scroll = tune.time_stamp;
					// Turn of our page_scroll listener, setting a new
					// scroll position would trigger it.
					$(window, document).off('scroll', _piedPiperScroll);
					$(document).scrollTop(tune.content * $(window).height());
					// Bind our page_scroll listener again
					window.setTimeout(function () { _scrollBind(); }, 100);
				}
				break;

			case 'scroll':
				// Don't sync normal scroll events. scrollTop triggers scroll again and it's cyclical. Also may conflict with the page_scroll listener.
				break;

			default:
				// All other jQuery events.
				// Check whether we've already received this message
				if (time_stamp.other < tune.time_stamp) {
					var instruction = {shouldtriggerpiedpiper: false};
					$(tune.content).trigger(tune.type, instruction);	// The instruction parameter is to stop our listening functions to be triggered by this.
					time_stamp.other = tune.time_stamp;
				}
		}
	};

	// Listen for page_scroll and jQuery events.
	var _listen = function () {

		// If config allows jQuery events
		if (config.tune_types.other) {

			// The flute is a reference to the Pied Piper,
			// It is the thing that makes the tune,
			// i.e. the things that trigger events.

			// Get all the jQuery events
			var flutes = $.eventReport();

			for (var i in flutes) {

				var flute = flutes[i];

				for (var j in flute.events) {
					var jq_event = flute.events[j];
					if (jq_event == 'scroll') continue; // Once again, scroll events are difficult to deal with because of our page_scroll.
					
					// Attach the send function to the event
					$(flute.element).on(jq_event, function (event, instruction) {
						// These events shouldn't trigger when it is because we receive a signal from our socket server. Otherwise we'd keep going around in circles.
						if (typeof instruction != 'undefined') {
							if (!instruction.shouldtriggerpiedpiper) return;
						}
						tune.type = jq_event;
						tune.content = $(this).getPath(); // This is a unique jQuery selector for the element.
						_send(tune);
					});
				}
			}
		}

	};

	var _piedPiperScroll = (function () {

		var scroll_timeout = '';

		return function (e) {
			if (typeof e.originalEvent == 'undefined') return;
			window.clearTimeout(scroll_timeout);
			scroll_timeout = window.setTimeout(function () {
				tune.type = 'page_scroll';
				tune.content = $(document).scrollTop() / $(window).height();
				_send(tune);
			}, 100);
		};
	})();

	var _scrollBind = function () {
		if (config.tune_types.page_scroll) {
			// Listen to window scroll
			$(window, document).on('scroll', _piedPiperScroll);
		}
	};

	return {

		// Initialise our module.
		init: function () {

			// Because of social media share buttons, don't do any of this in an iframe
			if (self == top) {
				// Connect to the socket.io server.
				_connect();

				socket.on('tune', function (tune) {
					_receive(tune);
				});
				
				socket.on('client_id', function (client_id) {
					_setClient(client_id);
				});
			}
		}
	};
})(io);

$(function () {
	piedpiper.init();
});

// Got this code from http://stackoverflow.com/questions/2068272/getting-a-jquery-selector-for-an-element
jQuery.fn.getPath = function () {
    if (this.length != 1) throw 'Requires one element.';

    var path, node = this;
    while (node.length) {
        var realNode = node[0];
        var name = (

            // IE9 and non-IE
            realNode.localName ||

            // IE <= 8
            realNode.tagName ||
            realNode.nodeName

        );

        // on IE8, nodeName is '#document' at the top level, but we don't need that
        if (!name || name == '#document') break;

        name = name.toLowerCase();
        if (realNode.id) {
            // As soon as an id is found, there's no need to specify more.
            return name + '#' + realNode.id + (path ? '>' + path : '');
        } else if (realNode.className) {
            name += '.' + realNode.className.split(/\s+/).join('.');
        }

        var parent = node.parent(), siblings = parent.children(name);
        if (siblings.length > 1) name += ':eq(' + siblings.index(node) + ')';
        path = name + (path ? '>' + path : '');

        node = parent;
    }

    return path;
};

// Got this code from http://stackoverflow.com/questions/743876/list-all-javascript-events-wired-up-on-a-page-using-jquery, then modified it. I would love to know about a way to do this that is framework agnostic.
$.eventReport = function(selector, root) {

	var selectors = [];
	var count = 0;

	$(selector || '*', root).andSelf().each(function() {

		// Get events bound on this element
		var events = $._data(this, 'events');
		if(!events) return;

		selectors[count] = {element: '',  events: []};

		// Add the selector for this element to our list
		selectors[count].element = $(this).getPath();

		// Loop through events for this element
		for (var i in events) {
			var event = events[i],
			h = event.length;
			if (h) selectors[count].events.push(i);
		}
		count++;
	});
	return selectors;
}
$.fn.eventReport = function(selector) {
	return $.eventReport(selector, this);
}
