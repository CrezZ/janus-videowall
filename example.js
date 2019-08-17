window.Room = require('./src');
const Settings = window.Settings = require('./settings');

var room;
var roominit;
var adapter =  require('webrtc-adapter');

var createRoom = function(){
    room.createRoom({
      room: Settings.roomId,
      secret: (Settings.adminToken || ''),
      publishers: 20,
      is_private: true,
     allowed: [(Settings.token || '')],

    })
      .then(() => {
        setTimeout(function() {
          room.register({
            username: Settings.username,
            room: Settings.roomId,
	    secret: Settings.adminToken || '',
          });
        }, 1000);
      })
      .catch((err) => {
        console.log('1'+err.message);
      })

}

var createAudioRoom = function(){
    room.createAudioRoom({
      room: Settings.roomId,
      secret: (Settings.adminToken || ''),
      publishers: 20,
      is_private: true,
     allowed: [(Settings.token || '')],

    })
      .then(() => {
        setTimeout(function() {
          room.registerAudio({
            username: Settings.username,
            room: Settings.roomId,
	    secret: Settings.adminToken || '',
          });
        }, 1000);
      })
      .catch((err) => {
        console.log('1'+err.message);
      })

}

// Event handlers
var onError = function(err) {
  if (typeof err.indexOf === "function" && err.indexOf('The room is unavailable') > -1) { ///video room
    alert('Room  is unavailable. Created.');
    createRoom();
  } else 
  if (typeof err.indexOf === "function" && err.indexOf('No such room') > -1) { //audio room
    alert('Audio Room  is unavailable. Created.');
    createAudioRoom();
  } else {



if (err.response && err.response.status )  // HTTP Error
{
    var errno = err.response.status;
    switch (errno){
    case 404:{//token not found. TImeout. Restart all
	if (err.message.indexOf('API')!= -1){ //API call failed
    	        room.stop();
		initroom();
	    }
    }
    case 458:{ //Session not found... restart all
	
    }
    
    }
}
//
if (Settings.debug){ //print to chatbox debug errors
  $('#chatbox').append(err.message);
}
    console.log('e2-'+err.message);
    if (err.error && err.error.message)
        console.log('e2-'+err.error.message);
    if (err && err.response)
        console.log('e2-'+JSON.stringify(err.response));
  
 }
}

var onWarning = function(msg) {
  alert(msg);
}

var onVolumeMeterUpdate = function(streamIndex, volume) {
  let el = document.getElementById('volume-meter-'+streamIndex);
  if (el) el.style.width = volume + '%';
}

var onLocalJoin = function() {
  var htmlStr = '<div>' + username + '</div><div>';
  htmlStr += '<button id="local-toggle-mute-audio" onclick="localToggleMuteAudio()">Mut</button>';
  htmlStr += '<button id="local-toggle-mute-video" onclick="localToggleMuteVideo()">NoVid</button>';
  htmlStr += '<button id="local-toggle-video" onclick="localToggleVideo()">ReVid</button></div><div>';
  htmlStr += '<video id="myvideo" style="width:100%;" autoplay muted="muted"/></div>';
  document.getElementById('videolocal').innerHTML = htmlStr;
  let target = document.getElementById('myvideo');
  room.attachStream(target, 0);

  if ($grid) $grid.isotope('layout');
}

var onRemoteJoin = function(index, remoteUsername, feedId, id) {
 // id == publisher Id
console.log('new feed - '+index+' '+remoteUsername + 'feed' + feedId + 'id'+id);
if (Settings.usernameFilter && remoteUsername.indexOf(Settings.usernameFilter)!=0) { // DO FILTER
console.log('Filtered feed');
return; 
}
var addAdminTools = (Settings.isAdmin && Settings.adminToken)? 
	    "<div><button id='remote-kick-"+index+"' onclick='remoteKick("+id+");'>Kick</button>"+
	    "<button id='remote-low-"+index+"' onclick='remoteLowBW("+id+");'>LowBW</button>"+
	    "<button id='remote-mute-"+index+"' onclick='remoteBute("+id+");'>Mute</button></div>"
	    :"" ;
	var volumeBar= '<div style="width:100%;">  <div id="volume-meter-'+index+'" style="height:5px;width:50%;background-color:green;"></div></div>';
	var el=document.getElementById('videoremote'+index);
    if ( el == null ) { //check if nit exists
	var item=$('<div class="grid-item grid-item-click" id="videoremote'+index+'">'+
	volumeBar+'<div>' + remoteUsername  + '<span id="bitrateremote'+index+'"></span></div>'+addAdminTools+'<div><video style="width:100%;" id="remotevideo' + index + '" autoplay/></div>'
	+ '</div>');
	 // TODO remove jquery
	    $grid.append(item).isotope( 'appended',item).isotope('layout');
		} //if
	    else
	    { console.log('Div exists');
	}
  //document.getElementById('videoremote' + index).innerHTML = 
  let target = document.getElementById('remotevideo' + index);
  room.attachStream(target, index);
 // update bitrate
   if (!target.dataset.bitratetimer)
	target.dataset.bitratetimer=   setInterval(function(){
		room.getStreamBitrate(index)
			.then(function(result){ 
				document.getElementById('bitrateremote' + index).innerHTML = ' '+result+ 'kbps';
			});
		},3000);
    // todo create callback
  if (Settings.onRemoteAttach)Settings.onRemoteAttach('remotevideo' + index); //Callback

  

}

var onRemoteJoinAudio = function(index, remoteUsername, feedId, id) {
 // id == publisher Id
console.log('new audio feed - '+index+' '+remoteUsername + 'feed' + feedId + 'id'+id);
if (Settings.usernameFilter && remoteUsername.indexOf(Settings.usernameFilter)!=0) { // DO FILTER
console.log('Filtered feed');
return; 
}
var addAdminTools = (Settings.isAdmin && Settings.adminToken)? 
	    "<div>"+
	    "<button id='audioremote-mute-"+index+"' onclick='MuteAudio("+index+");'>UnMute</button></div>"
	    :"" ;
	var volumeBar= '<div style="width:100%;">  <div id="volume-meter-audio-'+index+'" style="height:5px;width:1%;background-color:green;"></div></div>';
	var el=document.getElementById('audioremote'+index);
    if ( el == null ) { //check if nit exists
	var item=$('<div class="grid-item grid-item-click" id="audioremote'+index+'"> Audio Bridge'+
	volumeBar+'<div>' + remoteUsername  + '<span id="bitrateaudioremote'+index+'"></span></div>'+addAdminTools+
    '<div><audio style="width:100%;" id="remoteaudio' + index + '" autoplay/></div>'
	+ '</div>');
	 // TODO remove jquery
	    $grid.append(item).isotope( 'appended',item).isotope('layout');
		document.getElementById('audioremote'+index).dataset.mute = true;
		} //if
	    else
	    { console.log('Div exists');
	}
	
  //document.getElementById('videoremote' + index).innerHTML = 
  let target = document.getElementById('remoteaudio' + index);
  room.attachAudioStream(target, index);
 // update bitrate
	/*target.dataset.bitratetimer=
	    setInterval(function(){
		room.getStreamBitrate(index)
		.then(function(result){ 
		    document.getElementById('bitrateremote' + index).innerHTML = ' '+result+ 'kbps';
	    });
	},3000);*/
    // todo create callback
//  if (Settings.onRemoteAttach)Settings.onRemoteAttach('remotevideo' + index); //Callback


}

var onRemoteUnjoin = function(index) {
console.log('remove feed - '+index);
var el=document.getElementById('remotevideo'+index);
var el2=document.getElementById('videoremote'+index);
// todo it is not work !!!
 clearInterval(el.dataset.bitratetimer);

  $grid.isotope( 'remove',el2).isotope('layout');

}

var onRecordedPlay = function() {
  var htmlStr = '<div>playback</div>';
  htmlStr += '<video id="playback" style="width:inherit;" autoplay muted="muted"/>';
  document.getElementById('videoplayback').innerHTML = htmlStr;
  let target = document.getElementById('playback');
  room.attachRecordedPlayStream(target);
}

var onMessage = function(data) {
  if (!data) {
    return 0;
  }
  if (data.type && data.type === 'chat') {
    document.getElementById("chatbox").innerHTML += '<p>' + data.sender + ' : ' + data.message + '</p><hr>';
  } else if (data.type && data.type === 'request') {
    if (data.action && data.action === 'muteAudio') {
    return 0;
    }
  }
    return 0;

}

var slowLink = function(uplink,nacks){
  console.log('Bitrate limited to 64Kb/s, uplink='+uplink+',nack='+nacks);
  window.myfeed.send({"message": { "request": "configure", "bitrate": 64000 }});

}

var options = {
  server: Settings.server,
  debug: true,
  adapter:adapter.default,
  room: Settings.roomId,
  token: Settings.token || '123123123',
  secret: Settings.adminToken || '123123123',
  extensionId: Settings.extensionid || 'bkkjmbohcfkfemepmepailpamnppmjkk',
  publishOwnFeed: Settings.publishOwnFeed,
  iceServers: Settings.iceServers || [{ urls : 'stun:stun.l.google.com:19302' }],
  useRecordPlugin: true,
  volumeMeterSkip: 10,
  onLocalJoin: onLocalJoin,
  onRemoteJoin: onRemoteJoin,
  onRemoteJoinAudio: onRemoteJoinAudio,
  onRemoteUnjoin: onRemoteUnjoin,
  onRecordedPlay: onRecordedPlay,
  onMessage: onMessage,
  slowLink: slowLink,
  onError: onError,
  onWarning: onWarning,
  onVolumeMeterUpdate: onVolumeMeterUpdate,
}

room = window.room = new window.Room(options);

roominit = function (){
room.init()
  .then(function() {
    setTimeout(function() {
      room.register({
        username: Settings.username,
        room: Settings.roomId,
      });
      room.registerAudio({
        username: Settings.username,
        room: Settings.roomId,
      });

    }, 1000);

  })
  .catch((err) => {
    alert(err);
  });
}

//roominit();

document.getElementById('sharescreen').onclick = function() {
  room.shareScreen()
    .then(() => {
    })
    .catch((err) => {
      alert(err);
    });
}

document.getElementById('stopsharescreen').onclick = function() {
  room.stopShareScreen()
    .then(() => {
    })
    .catch((err) => {
      alert(err);
    });
}
document.getElementById('stop').onclick = function() {
room.stop();
}

document.getElementById('remove').onclick = function() {
  room.removeRoom()
    .then(() => {
      setTimeout(() => {
        room.stop()
      }, 500);
    });
  alert('Successfuly quit. The page needs to be reloaded.');
  //window.location.reload();
}

document.getElementById('lowbitrate').onclick = function() {
  alert('Bitrate limited to 64Kb/s');
  window.myfeed.send({"message": { "request": "configure", "bitrate": 64000 }});
//sfutest.send({"message": { "request": "configure", "bitrate": bitrate }});

}

document.getElementById('register').onclick = function() {
room.stop();
roominit();
//  room.register({
//    username: username
//  });
}

document.getElementById('chatsend').onclick = function() {
  var message = document.getElementById('chatinput').value;
  room.sendMessage({
    type: 'chat',
    sender: username,
    message: message
  })
    .then(function(data) {
      document.getElementById("chatbox").innerHTML += '<p>' + username + ' : ' + message + '</p><hr>';
    });
}

document.getElementById('getrecordedlist').onclick = function() {
  room.getRecordedList()
    .then((result) => {
      console.log(result);
      if (result && result.list && result.list.length > 0) {
        let recordedListElement = document.getElementById('recordedlist');
        recordedListElement.innerHTML = '';
        for (let i in result.list) {
          recordedListElement.innerHTML += '<a href="#" onClick="recordedPlayback(' + result.list[i].id + ')">' + result.list[i].name + '</a><br>';


        }
      }
    })
    .catch((err) => {
      alert(err);
    });
}

document.getElementById('stoprecording').onclick = function() {
  room.stopRecording()
    .then(function() {
      alert('Recording is being stopped.')
    })
    .catch((err) => {
      alert(err);
    });
}

document.getElementById('startrecording').onclick = function() {
  let recordName = window.prompt('Record name : ');
  room.startRecording({
    name: recordName
  });
}

window.recordedPlayback = function(recordId) {
  room.recordedPlayback(recordId);
}

window.localToggleMuteAudio = function() {
  room.toggleMuteAudio()
    .then((muted) => {
      var el = document.getElementById('local-toggle-mute-audio');
      if (muted) {
        el.innerHTML = "Unmute";
      } else {
        el.innerHTML = "Mute";
      }
    });
}

window.localToggleMuteVideo = function() {
  room.toggleMuteVideo()
    .then((muted) => {
      var el = document.getElementById('local-toggle-mute-video');
      if (muted) {
        el.innerHTML = "Resume webcam";
      } else {
        el.innerHTML = "Pause webcam";
      }
    });
}

window.localToggleVideo = function() {
  room.toggleVideo()
    .then((stopped) => {
      console.log(stopped);
    });
}

window.remoteKick = function(index){
window.myfeed.send({message:{
"request" : "kick",
 "secret" : (Settings.adminToken || ''),
 "room": Settings.roomId, 
 "id": index,
    }
});
return false; //prevent inherit
}

window.MuteAudio = function(index){
	var mute=true; 
	var mutestr='';
	var el=document.getElementById('audioremote'+index);
	if (el && el.dataset ) {
		if (el.dataset.mute == 'true')
		{mute=false;mutestr='Mute';} 
	else 
		{mute=true;mutestr='UnMute';}  
    }
	if (el && el.dataset )	{el.dataset.mute = mute;}
	document.getElementById('audioremote-mute-'+index).innerHTML=mutestr;
window.myaudiofeed.send({message:{
"request" : "configure",
 //"secret" : (Settings.adminToken || ''),
  "muted": mute,
    }
});
return false; //prevent inherit
}