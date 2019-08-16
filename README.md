
### Janus VideoWall (Room

Project based on this repo https://github.com/tarsiusid/janus-room.
But have many changes and bug improvements.

A Janus client library that provides simple interface to create a minimal-complete conference video room. This is adopted from Janus demo example code but it's JQuery-less and React/Vue friendly.

### NEW in project

```
1 add webrtc-adapter inside bundle for interation with native code (bad idea, but it works for dynamic loading pages).
2 add settings.js for override default settings in separate file.
3 add additional callbacks for add/remove new videos events, start/stop remote stream. In example2/3 it used for rearrange vdeo mosaic.
4 add example2.html with automatic arrange video mosaic, based on Isotope (https://isotope.metafizzy.co). Click on video enlargement it.
5 add example3.html with filter received videos by username.
6 add global slowLink callback to set 64К bitrate on bad network.
7 add AudioBridge support to room for many to many audio without video;


Add admin tools for manage rooms, example in admin.html

npm run build-admin
admin.js --> admin-bundle.js


```


### Install in new project

```
$ npm install janus-room
$ npm install webrtc-adapter

For example2/3

$ npm install isotope-layout
```

### Basic usage

```
//Native code
import adapter from 'webrtc-adapter';
import Room from 'janus-room';
import Settings from './setting';

//NPM code

window.Room = require('./src');
const Settings = window.Settings = require('./settings');
var adapter =  require('webrtc-adapter');

...

//Change settings in settings.js or add this code
//Note - usernameFilter (first part of username wich videos will be added to screen), baseUsername (change default username) must be defined BEFORE add <script> in page for usage.

var Settings = {
 server : 'https://mcu1.myserver.ru:8089/janus',
 roomId : 13371, // Demo room
 usernameFilter : (typeof usernameFilter != 'undefined')? usernameFilter : null,
 username : ((typeof baseUsername != 'undefined')? baseUsername : 'user'  + (new Date()).valueOf()),
 publishOwnFeed: window.confirm("Start video?")
}


...

var options = {
  server: server, // required

  // Event handlers
  onLocalJoin: onLocalJoin,
  onRemoteJoin: onRemoteJoin,
  onRemoteUnjoin: onRemoteUnjoin,
  onMessage: onMessage,
  onError: onError,
}

var room = new Room(options);
room.init()
.then(function(){
  room.register({
    room: roomId,
    username: username
  });
})
.catch(function(err){
  alert(err);
});
```

### Methods

- `room.init()` - Initialize the session.

- `room.register({room: roomId, username: username})` - Join to the room as username.
- `room.sendMessage(data)` - Send message throught Janus's DataChannel (activated by default).
- `room.attachStream(element, streamIndex)` - Attach a remote stream to a `<video>` element. Local stream is on 0.
- `room.shareScreen()` - Share screen.
- `room.stopShareScreen()` - Stop share screen and switch back to webcam.
- `room.createRoom({room:1337})` - Create new room.
- `room.removeRoom()` - Remove current room.
- `room.isShareScreenStream(streamIndex)` - Detect whether the stream is a sharescreen. Local stream is on 0.
- `room.getStream(streamIndex)` - Get stream instance by stream index.
- `room.getStreamBitrate(streamIndex)` - Get stream last bitrate by stream index.
- `room.toggleMuteAudio()` - Toggle local mic.
- `room.toggleMuteVideo()` - Toggle local video stream.
- `room.toggleVideo()` - Toggle local video stream.

Please note that toggleMute\* only mute the stream, not stop it. Use `togggleVideo()` instead to stop the video stream.

### Events (passed as params)

- `onLocalJoin(() => { ...`
- `onRemoteJoin((streamIndex, username, feedId) => { ...`
- `onRemoteUnjoin((streamIndex) => { ...`
- `onMessage((data) => { ...`
- `onVolumeMeterUpdate((streamIndex, volumeLevel) => { ...`
- `onError((err) => { ...`
- `onWarning((msg) => { ...`

### Working example

Adjust the Janus gateway URL in `settings.js`, then,

- `npm install`
- `npm run build`
- Open `example.html` on your web browser.

### Warning

parent project `janus-room` and this project is still in heavy development and will makes many breaking API changes.


