piedpiper.js
============

piedpiper.js is a socket.io server that allows you to synchronise web page navigation, scrolling, and jQuery events across multiple browsers. It was created at Trigger Isobar for our Open Device Lab, and inspired by [Shim](https://github.com/marstall/shim).

Installation
------------
First, clone into this repo. Then run:
```
npm install socket.io
```
Then you need to include `piedpiper.js` and jQuery in your web page. You can add it to your pages, but that way sucks. We do this transparently, by configuring Apache as a transparent forward proxy, and having it modify the page footer on the fly:
```
Listen 8081

<VirtualHost *:8081>

	ProxyRequests On
	ProxyVia On

	ServerName opendevicelab

	RewriteEngine On

	# if a REQUEST_URI starts with a / then do the rewrite
	RewriteCond %{REQUEST_URI} ^/

	# alter the GET /... to GET http://host/... so it is treated as
	# a proxy request, and then forward it to mod_proxy immediately
	RewriteRule (.*) http://%{HTTP_HOST}$1 [P]

	# Inflate the content if it is deflated
	FilterDeclare gzinflate
	FilterProvider gzinflate INFLATE resp=Content-Encoding $gzip
	FilterProvider gzinflate INFLATE resp=Content-Encoding $deflate

	# Do the substitution
	FilterDeclare replace
	FilterProvider replace SUBSTITUTE resp=Content-Type $html

	# Deflate the content if it was deflated
	FilterDeclare gzdeflate
	FilterProvider gzdeflate DEFLATE req=Accept-Encoding $gzip

	<Location />
		FilterChain gzinflate replace gzdeflate

		# Add jQuery if we don't already have it
		Substitute "s#</body>#<script>window.jQuery || document.write('<script src=\"http://jquery.opendevicelab/jquery-1.8.3.min.js\"></' + 'script>')</script></body>#i"
		# Add socket.io
		Substitute "s|</body>|<script src=\"http://piedpiper.opendevicelab:3128/socket.io/socket.io.js\"></script></body>|i"
		# Add piedpiper.js
		Substitute "s|</body>|<script src=\"http://piedpiper.opendevicelab/piedpiper.js\"></script></body>|i"
	</Location>

	<Proxy *:8081>
		Order deny,allow
		Deny from all
		Allow from 192.168
	</Proxy>

</VirtualHost>
```
Be sure to set up your firewall so that the traffic you want to inject this code into is configured to DNAT it to the Apache proxy.

Once that is all done, run `node piedpiper-server.js` and presto, all traffic on that network is synched.

In order to achieve this we have 2 wireless interfaces on our proxy server, one for the local web server, and one for all the devices. The server also has a ethernet connection to the internet.

It's pretty early days for this project. Pull requests very welcome!
