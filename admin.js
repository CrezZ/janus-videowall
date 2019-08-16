window.Room = require('./src');
const Settings = window.Settings = require('./settings');
var adapter =  require('webrtc-adapter');


onMessage = function(){
}
onError = function(){
}
onWarning = function(){
}

var room;
var options = {
  server: Settings.server,
  adapter:adapter.default,
  room: Settings.roomId,
  token: Settings.token || '123123123',
  secret: Settings.adminToken || '123123123',
  extensionId: Settings.extensionid || 'bkkjmbohcfkfemepmepailpamnppmjkk',
  onMessage: onMessage,
//  onError: onError,
  onWarning: onWarning,
}

room = window.room = new window.Room(options);
room.init();

document.getElementById('getroomlist').onclick = function() {
  room.getRoomList()
    .then((result) => {
      console.log(result);
      if (result && result.list && result.list.length > 0) {
        let recordedListElement = document.getElementById('roomlist');
        recordedListElement.innerHTML = '';
        for (let i in result.list) {
          recordedListElement.innerHTML += '<a href="#" onClick="roomDetail(' + result.list[i].room + ')">' + result.list[i].room + 
	' - ' + result.list[i].description + ' (Max - '+result.list[i].max_publishers+'), current - '+
result.list[i].num_participants +' streams</a><br>';
        }
      }
    })
    .catch((err) => {
      alert(err);
    });
}

window.roomDetail = function(id){

  room.getRoomParticipants(id)
    .then((result) => {
      console.log(result);
        let recordedListElement = document.getElementById('roomdetail');
        recordedListElement.innerHTML = '';

      if (result && result.participants && result.participants.length > 0) {
        for (let i in result.participants) {
	var a=result.participants[i];
          recordedListElement.innerHTML += '<a href="#" onClick="partDetail(this,' +id+','+ a.id + ')">' + a.id + 
	' - ' + a.display + ' (video - '+a.internal_video_ssrc+' audio - '+
a.internal_audio_ssrc +' streams</a><br>';
        }
      }
    })
    .catch((err) => {
      alert(err);
    });
}

function insertAfter(newNode, referenceNode) {
var el= document.createElement("span");
el.innerHTML=newNode;
el.id='partAction';
    referenceNode.parentNode.insertBefore(el, referenceNode.nextSibling );
}

window.partDetail = function(element,room,participant){
insertAfter('<button onclick="kick('+room+','+participant+",'kick');\"> Kick </button>", element);
}

window.kick = function (room,participant,action){
window.myfeed.send({message:{
    request: action,
    room: room,
    id: participant,
    secret: prompt('Password for room: ')
}
});
}
