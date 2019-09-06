const Janus = window.Janus = require('./janus');
const volumeMeter = require('volume-meter-skip');
const Spinner = require('spin');
const MaxStreams = 128;
window.AudioContext = window.AudioContext || window.webkitAudioContext;

var config = {
  remotestreams: {},
  feeds: [],
  bitrateTimer: [],
  remoteaudiostreams: {},
  feedsaudio: [],
  bitrateTimeraudio: []
}

window.remotestreams = config.remotestreams;
window.remoteaudiostreams = config.remoteaudiostreams;
window.configroom = config;
// TODO Remove unused events / functions

// Helpers
function getQueryStringValue(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
  var results = regex.exec(location.search);
  return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function publishOwnFeed(opts, cb) {
  opts = opts || {}
  // Publish our stream
  config.isShareScreenActive = false;
//    alert (Janus.webRTCAdapter.browserDetails);
  config.videoRoomHandler.createOffer(
    {
      // Add data:true here if you want to publish datachannels as well
      media: {
        audioRecv: false,
        videoRecv: false,
        audioSend: opts.audioSend,
        replaceAudio: opts.replaceAudio,
        videoSend: Janus.webRTCAdapter.browserDetails.browser === 'safari' ? false : opts.videoSend,
        replaceVideo: opts.replaceVideo,
        data: true,
      }, // Publishers are sendonly
      simulcast: doSimulcast,
      success: function(jsep) {
        Janus.debug("Got publisher SDP!");
        Janus.debug(jsep);
        var publish = {
          "request": "configure",
          "audio": opts.audioSend,
          "video": Janus.webRTCAdapter.browserDetails.browser === 'safari' ? false : true,
          "data": true,
        };
        if (config.token) publish.token = config.token;
        config.videoRoomHandler.send({
          "message": publish,
          "jsep": jsep
        });
        if (cb) { //Callback
          cb();
        }
      },
      error: function(error) {
        Janus.error("WebRTC error:", error);
        if (opts && opts.audioSend) {
          publishOwnFeed({
            audioSend: false
          });
        } else {
          config.onError("WebRTC error... " + JSON.stringify(error));
        }
      }
    });
}


// Unpublish our stream
function unpublishOwnFeed() {
  return new Promise((resolve, reject) => {
    var unpublish = {
      "request": "unpublish",
    };
    if (config.token) unpublish.token = config.token;
    config.videoRoomHandler.send({
      "message": unpublish,
      success: function(){
        resolve();
      },
      error: function(err) {
        reject(err);
      }
    });
  });
}

function shareScreen(cb) {
  // Publish our stream
  config.videoRoomHandler.createOffer(
    {
      // Add data:true here if you want to publish datachannels as well
      media: {
        video: 'screen',
        videoRecv: false,
        audioSend: true,
        videoSend: true,
        data: true,
      }, // Publishers are sendonly
      success: function(jsep) {
        Janus.debug("Got publisher SDP SCREEN!");
        Janus.debug(jsep);
        var publish = {
          "request": "configure",
          "audio": true,
          "video": true,
          "data": true
        };
        if (config.token) publish.token = config.token;
        config.isShareScreenActive = true;
        config.videoRoomHandler.send({
          "message": publish,
          "jsep": jsep
        });
      },
      error: function(error) {
        Janus.error("WebRTC error:", error);
        if (cb) {
          cb(error);
        }
      }
    });
}

function startRecording(options) {
  config.recordPlayHandler.send({
    'message': {
      'request': 'configure',
      'video-bitrate-max': 1024 * 1024, // a quarter megabit
      'video-keyframe-interval': 15000 // 15 seconds
    }
  });
  config.recordPlayHandler.createOffer(
    {
      // By default, it's sendrecv for audio and video... no datachannels
      // If you want to test simulcasting (Chrome and Firefox only), then
      // pass a ?simulcast=true when opening this demo page: it will turn
      // the following 'simulcast' property to pass to janus.js to true
      simulcast: doSimulcast,
      success: function(jsep) {
        Janus.debug("Got SDP!");
        Janus.debug(jsep);
        var body = {
          "request": "record",
          "name": options.name || 'janus-room-test-' + (new Date()).valueOf(),
        };
        config.recordPlayHandler.send({
          "message": body,
          "jsep": jsep
        });
      },
      error: function(error) {
        Janus.error("WebRTC error...", error);
        bootbox.alert("WebRTC error... " + error);
        config.recordPlayHandler.hangup();
      }
    });
}

function stopPlayback() {
  return new Promise((resolve, reject) => {
    var stop = {
      "request": "stop",
    };
    config.recordPlayHandler.send({
      "message": stop,
      success: function() {
        resolve();
      },
      error: function(err) {
        reject(err);
      }
    });
  });
}

function start() {
  return new Promise((resolve, reject) => {
    try {
      // Make sure the browser supports WebRTC
      if (!Janus.isWebrtcSupported()) {
        config.onError("No WebRTC support... ");
        return;
      }
      // Create session
      config.janus = new Janus(
        {
          server: config.server,
          token: config.token,
//	  slowLink: config.slowLink,
          success: function() {

            // Attach to video room plugin
            config.janus.attach(
              {
                plugin: "janus.plugin.videoroom",
                opaqueId: config.opaqueId,
		  slowLink: config.slowLink,
                success: function(pluginHandle) {
                  config.videoRoomHandler = window.myfeed = pluginHandle;
                  Janus.log("Plugin attached! (" + config.videoRoomHandler.getPlugin() + ", id=" + config.videoRoomHandler.getId() + ")");
                  Janus.log("  -- This is a publisher/manager");
                  resolve();
                },
                error: function(error) {
                  Janus.error("  -- Error attaching plugin...", error);
                  config.onError("Error attaching plugin... " + error);
                },
                consentDialog: function(on) {
                  Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
                  if (on) {
                    // Darken screen and show hint
                  } else {
                    // Restore screen
                  }
                },
                mediaState: function(medium, on) {
                  Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
                  // FIXME Be aware, in Chrome, this on signal is not always true
                },
                webrtcState: function(on) {
                  Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                },
                onmessage: function(msg, jsep) {
                  Janus.debug(" ::: Got a message (publisher) :::");
                  Janus.debug(msg);
                  Janus.debug(jsep);
                  config.videoRoomHandler.alive = true;
    		var result = msg["result"];
                  var event = msg["videoroom"];
                  Janus.debug("Event: " + event);
                  if (event != undefined && event != null) {
                    if (event === "joined" && !config.isShareScreenActive) {
                      // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                      config.myid = msg["id"];
                      config.mypvtid = msg["private_id"];
                      Janus.log("Successfully joined room " + msg["room"] + " with ID " + config.myid);
                      if (config.publishOwnFeed) {
                        publishOwnFeed({
                          audioSend: true
                        });
                      }
                      // Any new feed to attach to?
                      if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
                        var list = msg["publishers"];
                        Janus.debug("Got a list of available publishers/feeds:");
                        Janus.debug(list);
                        for (var f in list) {
                          var id = list[f]["id"];
                          var display = list[f]["display"];
                          var audio = list[f]["audio_codec"];
                          var video = list[f]["video_codec"];
                          Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
						  if (config.onFilterName && config.onFilterName(display) || !config.onFilterName)
                            newRemoteFeed(id, display, audio, video);
                        }
                      }
                    } else if (event === 'slow_link') {
                      if (result && result !=null)   {
                        var uplink = result["uplink"];
                        if (uplink !== 0) {
                          if (config.onWarning) config.onWarning(msg);
                          // Janus detected issues when receiving our media, let's slow down
                          if (!config.isShareScreenActive) {
                            let bandwidth = parseInt(bandwidth / 1.5);
                            config.videoRoomHandler.send({
                              'message': {
                                'request': 'configure',
                                'bitrate': bandwidth, // Reduce the bitrate
                                'keyframe': 15000 // Keep the 15 seconds key frame interval
                              }
                            });
                          }
                        }
                      }
                    } else if (event === "destroyed") {
                      // The room has been destroyed
                      Janus.warn("The room has been destroyed!");
                      config.onDestroyed();
                    } else if (event === "event") {
                      // Any new feed to attach to?
                      if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
                        var list = msg["publishers"];
                        Janus.debug("Got a list of available publishers/feeds:");
                        Janus.debug(list);
                        for (var f in list) {
                          var id = list[f]["id"];
                          var display = list[f]["display"];
                          var audio = list[f]["audio_codec"];
                          var video = list[f]["video_codec"];
                          Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
						  if (config.onFilterName && config.onFilterName(display) || !config.onFilterName) 
                          newRemoteFeed(id, display, audio, video);
                        }
                      } else if (msg["leaving"] !== undefined && msg["leaving"] !== null) {
                        // One of the publishers has gone away?
                        var leaving = msg["leaving"];
                        Janus.log("Publisher left: " + leaving);
                        var remoteFeed = null;
                        for (var i = 1; i < MaxStreams; i++) {
                          if (config.feeds[i] != null && config.feeds[i] != undefined && config.feeds[i].rfid == leaving) {
                            remoteFeed = config.feeds[i];
                            break;
                          }
                        }
                        if (remoteFeed != null) {
                          Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                          config.feeds[remoteFeed.rfindex] = null;
                          remoteFeed.detach();
                        }
                      } else if (msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                        // One of the publishers has unpublished?
                        var unpublished = msg["unpublished"];
                        Janus.log("Publisher left: " + unpublished);
                        if (unpublished === 'ok') {
                          // That's us
                          config.videoRoomHandler.hangup();
                          return;
                        }
                        var remoteFeed = null;
                        for (var i = 1; i < MaxStreams; i++) {
                          if (config.feeds[i] != null && config.feeds[i] != undefined && config.feeds[i].rfid == unpublished) {
                            remoteFeed = config.feeds[i];
                            break;
                          }
                        }
                        if (remoteFeed != null) {
                          Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                          config.feeds[remoteFeed.rfindex] = null;
                          remoteFeed.detach();
                        }
                      } else if (msg["error"] !== undefined && msg["error"] !== null) {
                        if (msg["error_code"] === 426) {
                          config.onError('The room is unavailable. Please create one.');
                        } else {
                          config.onError(msg["error"]);
                        }
                      }
                    }
                  }
                  if (jsep !== undefined && jsep !== null) {
                    Janus.debug("Handling SDP as well...");
                    Janus.debug(jsep);
                    config.videoRoomHandler.handleRemoteJsep({
                      jsep: jsep
                    });
                    // Check if any of the media we wanted to publish has
                    // been rejected (e.g., wrong or unsupported codec)
                    var audio = msg["audio_codec"];
                    if (config.mystream && config.mystream.getAudioTracks() && config.mystream.getAudioTracks().length > 0 && !audio) {
                      // Audio has been rejected
                      Janus.debug("Our audio stream has been rejected, viewers won't hear us");
                    }
                    var video = msg["video_codec"];
                    if (config.mystream && config.mystream.getVideoTracks() && config.mystream.getVideoTracks().length > 0 && !video) {
                      // Video has been rejected
                      Janus.debug("Our video stream has been rejected, viewers won't see us");
                    // Hide the webcam video
                    }
                  }
                },
                onlocalstream: function(stream) {
                  Janus.debug(" ::: Got a local stream :::");
                  config.mystream = window.mystream = stream; // attach to global for debugging purpose
                  if (config.mystream.getVideoTracks().length > 0) {
                    config.mystream.getVideoTracks()[0].onended = function(){
                      if (config.isShareScreenActive && config.publishOwnFeed) {
                        console.log('Put back the webcam');
                        publishOwnFeed({
                          audioSend: true,
                          videoSend: true,
                          replaceVideo: true,
                          replaceAudio: true,
                        });
                      }
                    }
                  }
                  Janus.debug(stream);
                  config.onLocalJoin();
                  if (config.onVolumeMeterUpdate) {
                    let ctx = new AudioContext();
                    let meter = volumeMeter(ctx, { tweenIn:2, tweenOut:6, skip:config.volumeMeterSkip}, (volume) => {
                      config.onVolumeMeterUpdate(0, volume);
                    });
                    let src = ctx.createMediaStreamSource(config.mystream);
                    src.connect(meter);
                    config.mystream.onended = meter.stop.bind(meter);
                  }
                },
                onremotestream: function(stream) {
                  // The publisher stream is sendonly, we don't expect anything here
                },
                ondataopen: function(data) {
                  console.log('ondataopen');
                },
                oncleanup: function() {
                  Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
                  config.mystream = null;
                }
              });

            if (config.useRecordPlugin) {
              // Attach to config.recordPlayHandler plugin
              config.janus.attach(
                {
                  plugin: "janus.plugin.recordplay",
                  opaqueId: config.opaqueId,
                  success: function(pluginHandle) {
                    config.recordPlayHandler = pluginHandle;
                    Janus.log("Plugin attached! (" + config.recordPlayHandler.getPlugin() + ", id=" + config.recordPlayHandler.getId() + ")");
                  // Now ready for recording. See startRecording()
                  },
                  error: function(error) {
                    Janus.error("  -- Error attaching plugin...", error);
                    onError(error)
                  },
                  consentDialog: function(on) {
                    // Handle consentDialog
                  },
                  webrtcState: function(on) {
                    Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                  },
                  onmessage: function(msg, jsep) {
                    Janus.debug(" ::: Got a message :::");
                    Janus.debug(msg);
                    config.videoRoomHandler.alive = true;
                    var result = msg["result"];
                    if (result !== null && result !== undefined) {
                      if (result["status"] !== undefined && result["status"] !== null) {
                        var event = result["status"];
                        if (event === 'preparing' || event === 'refreshing') {
                          Janus.log("Preparing the recording playout");
                          config.recordPlayHandler.createAnswer(
                            {
                              jsep: jsep,
                              media: {
                                audioSend: false,
                                videoSend: false
                              }, // We want recvonly audio/video
                              success: function(jsep) {
                                Janus.debug("Got SDP!");
                                Janus.debug(jsep);
                                var body = {
                                  "request": "start"
                                };
                                config.recordPlayHandler.send({
                                  "message": body,
                                  "jsep": jsep
                                });
                              },
                              error: function(error) {
                                Janus.error("WebRTC error:", error);
                                alert(JSON.stringify(error));
                              }
                            });
                          if (result["warning"]) {
                            alert(result["warning"]);
                          }
                        } else if (event === 'recording') {
                          // Got an ANSWER to our recording OFFER
                          if (jsep !== null && jsep !== undefined) {
                            config.recordPlayHandler.handleRemoteJsep({
                              jsep: jsep
                            });
                          }
                          var id = result["id"];
                          if (id !== null && id !== undefined) {
                            Janus.log("The ID of the current recording is " + id);
                            config.recordingId = id;
                          }
                        } else if (event === 'slow_link') {
                          if (result) {
                            var uplink = result["uplink"];
                            if (uplink !== 0) {
                              if (config.onWarning) config.onWarning(msg);
                              // Janus detected issues when receiving our media, let's slow down
                              if (!config.isShareScreenActive) {
                                let bandwidth = parseInt(bandwidth / 1.5);
                                config.recordPlayHandler.send({
                                  'message': {
                                    'request': 'configure',
                                    'bitrate': bandwidth, // Reduce the bitrate
                                    'keyframe': 15000 // Keep the 15 seconds key frame interval
                                  }
                                });
                              }
                            }
                          }
                        } else if (event === 'stopped' && result) {
                          Janus.log("Session has stopped!");
                          var id = result["id"];
                          if (config.recordingId !== null && config.recordingId !== undefined) {
                            if (config.recordingId !== id) {
                              Janus.warn("Not a stop to our recording?");
                              return;
                            }
                            alert('Recording completed! Check the list of recordings to replay it.')
                          }
                        // TODO reset recording session
                        }
                      }
                    } else {
                      // FIXME Error?
                      var error = msg["error"];
                      alert(error)
                    //updateRecsList();
                    }
                  },
                  onlocalstream: function(stream) {
                    Janus.debug(" ::: Got a local stream :::");
                    Janus.debug(stream);
                    config.onRecordedPlay()
                  },
                  onremotestream: function(stream) {
                    config.recordedplaystream = stream;
                    Janus.debug(" ::: Got a remote stream :::");
                    Janus.debug(stream);
                    config.onRecordedPlay()
                  },
                  oncleanup: function() {
                    Janus.log(" ::: Got a cleanup notification :::");
                  // TODO reset recording session
                  }
                }); //RecordPlay


            if (config.useAudioBridgePlugin) {
              // Attach to config.audiuBridge plugin
            config.janus.attach(
              {
                plugin: "janus.plugin.audiobridge",
//                opaqueId: config.opaqueId,
				slowLink: config.slowLink,
                success: function(pluginHandle) {
                  config.audioBridgeHandler = window.myaudiofeed = pluginHandle;
				  config.feedsaudio[1]=pluginHandle;
                  Janus.log("Plugin attached! (" + config.audioBridgeHandler.getPlugin() + ", id=" + config.audioBridgeHandler.getId() + ")");
                  Janus.log("  -- This is a publisher/manager");
                  resolve();
                },
                error: function(error) {
                  Janus.error("  -- Error attaching plugin...", error);
                  config.onError("Error attaching plugin... " + error);
                },
                consentDialog: function(on) {
                  Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
                  if (on) {
                    // Darken screen and show hint
                  } else {
                    // Restore screen
                  }
                },
                mediaState: function(medium, on) {
                  Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
                  // FIXME Be aware, in Chrome, this on signal is not always true
                },
                webrtcState: function(on) {
                  Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                },
  	    onremotestream: function(stream) {
	        Janus.debug("Remote audio feed #" );
			//Janus.attachMediaStream($('#roomaudio').get(0), stream);
	        config.remoteaudiostreams[config.audioBridgeHandler.rfindex] = {}
	        config.remoteaudiostreams[config.audioBridgeHandler.rfindex].index = config.audioBridgeHandler.rfindex;
	        config.remoteaudiostreams[config.audioBridgeHandler.rfindex].feedId = config.audioBridgeHandler.getId();
	        config.remoteaudiostreams[config.audioBridgeHandler.rfindex].stream = stream;
			//Callback
	        config.onRemoteJoinAudio(config.audioBridgeHandler.rfindex, 
				config.audioBridgeHandler.rfdisplay, config.audioBridgeHandler.getId(), '');
	//            config.onRemoteJoinAudio(1, msg['display'] || '', '', msg['id']);

		},

          onmessage: function(msg, jsep) {
                  Janus.debug(" ::: Got a message (publisher) :::");
                  Janus.debug(msg);
                  Janus.debug(jsep);
                  //config.videoRoomHandler.alive = true;
    		var result = msg["result"];
                  var event = msg["audiobridge"];
                  Janus.debug("Event: " + event);
                  if (event != undefined && event != null) {
                    if (event === "joined" ) {
                      // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                      config.myidaudio = msg["id"];
                      config.mypvtidaudio = msg["private_id"];
                      Janus.log("Successfully joined room " + msg["room"] + " with ID " + config.myidaudio);
					  //TODO
					  config.audioBridgeHandler.rfindex=1;
											//if(!webrtcUp) {
												
												// Publish our stream
					config.audioBridgeHandler.createOffer({
					media: { video: false},	// This is an audio only room
					success: function(jsep) {
						Janus.debug("Got SDP!");
						Janus.debug(jsep);
						var publish = { "request": "configure", "muted": true };
						config.audioBridgeHandler.send({"message": publish, "jsep": jsep});
						},
					error: function(error) {
							Janus.error("WebRTC error:", error);
						}
						});
											//}
					  
					  
//                      if (config.publishOwnFeed) {
//                        publishOwnFeed({
//                          audioSend: true
//                        });
//                      }
////////////////// TODO this
		    
	//            config.onRemoteJoinAudio(1, msg['display'] || '', '', msg['id']);


                      // Any new feed to attach to?
                      if (msg["participants"] !== undefined && msg["participants"] !== null) {
                        var list = msg["participants"];
                        Janus.debug("Got a list of available publishers/feeds:");
                        Janus.debug(list);
                        for (var f in list) {
                          var id = list[f]["id"];
                          var display = list[f]["display"];
/////// TODO  do anything... Add to list...
//                          newRemoteFeedAudio(id, display, audio);

                        }
                      }
                    }  else if (event === "destroyed") {
						
				/// TODO
                      // The room has been destroyed
                      Janus.warn("The room has been destroyed!");
                      config.onDestroyed();
                    } else if (event === "event") {
                      // Any new feed to attach to?
                      if (msg["participants"] !== undefined && msg["participants"] !== null) {
                        var list = msg["participants"];
                        Janus.debug("Got a list of available publishers/feeds:");
                        Janus.debug(list);
                        for (var f in list) {
                          var id = list[f]["id"];
                          var display = list[f]["display"];
///// TOOD
                    //      newRemoteFeedAudio(id, display, audio);
                        }
                      } else if (msg["leaving"] !== undefined && msg["leaving"] !== null) {
                        // One of the publishers has gone away?
                        var leaving = msg["leaving"];
                        Janus.log("Publisher left: " + leaving);
                        /*var remoteFeed = null;
                        for (var i = 1; i < 6; i++) {
                          if (config.feedsaudio[i] != null && config.feedsaudio[i] != undefined && config.feedsaudio[i].rfid == leaving) {
                            remoteFeed = config.feedsaudio[i];
                            break;
                          }
                        } */
						
						 /*
                        if (remoteFeed != null) {
                          Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                          config.feeds[remoteFeed.rfindex] = null;
                          remoteFeed.detach();
                        } */
						
                      } 
    /* // TODO mute?
		    else 
		    if (msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                        // One of the publishers has unpublished?
                        var unpublished = msg["unpublished"];
                        Janus.log("Publisher left: " + unpublished);
                        if (unpublished === 'ok') {
                          // That's us
                          config.videoRoomHandler.hangup();
                          return;
                        }
                        var remoteFeed = null;
                        for (var i = 1; i < 6; i++) {
                          if (config.feeds[i] != null && config.feeds[i] != undefined && config.feeds[i].rfid == unpublished) {
                            remoteFeed = config.feeds[i];
                            break;
                          }
                        }
                        if (remoteFeed != null) {
                          Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                          config.feeds[remoteFeed.rfindex] = null;
                          remoteFeed.detach();
                        }
                      } */ 
			else if (msg["error"] !== undefined && msg["error"] !== null) {
                        if (msg["error_code"] === 426) {
                          config.onError('The room is unavailable. Please create one.');
                        } else {
                          config.onError(msg["error"]);
                        }
                      }
                    }
                  }
                  if (jsep !== undefined && jsep !== null) {
                    Janus.debug("Handling SDP as well...");
                    Janus.debug(jsep);
                    config.audioBridgeHandler.handleRemoteJsep({
                      jsep: jsep
                    });
                    // Check if any of the media we wanted to publish has
                    // been rejected (e.g., wrong or unsupported codec)
                    //var audio = msg["audio_codec"];
                    //if (config.mystreamaudio && config.mystreamaudio.getAudioTracks() && config.mystreamaudio.getAudioTracks().length > 0 && !audio) {
                      // Audio has been rejected
                    //  Janus.debug("Our audio stream has been rejected, viewers won't hear us");
                   // }
/*                    var video = msg["video_codec"];
                    if (config.mystream && config.mystream.getVideoTracks() && config.mystream.getVideoTracks().length > 0 && !video) {
                      // Video has been rejected
                      Janus.debug("Our video stream has been rejected, viewers won't see us");
                    // Hide the webcam video
                    } */
                  }
                },
                onlocalstream: function(stream) {
                  Janus.debug(" ::: Got a local stream :::");
                  config.mystreamaudio = window.mystreamaudio = stream; // attach to global for debugging purpose
/*                  if (config.mystream.getVideoTracks().length > 0) {
                    config.mystream.getVideoTracks()[0].onended = function(){
                      if (config.isShareScreenActive && config.publishOwnFeed) {
                        console.log('Put back the webcam');
                        publishOwnFeed({
                          audioSend: true,
                          videoSend: true,
                          replaceVideo: true,
                          replaceAudio: true,
                        });
                      }
                    }
                  } */
                  Janus.debug(stream);
//                  config.onLocalJoin();
/*                  if (config.onVolumeMeterUpdate) {
                    let ctx = new AudioContext();
                    let meter = volumeMeter(ctx, { tweenIn:2, tweenOut:6, skip:config.volumeMeterSkip}, (volume) => {
                      config.onVolumeMeterUpdate(0, volume);
                    });
                    let src = ctx.createMediaStreamSource(config.mystream);
                    src.connect(meter);
                    config.mystream.onended = meter.stop.bind(meter);
                  }*/
                },
                ondataopen: function(data) {
                  console.log('ondataopen');
                },
                oncleanup: function() {
					
                  Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
				  
                  config.mystreamaudio = null;
				   //TODO
				  if (config.remotestreamsaudio) delete (config.remotestreamsaudio[1]);
			config.onRemoteUnjoinAudio(1, '');
                }
              });
		}
	      }
             },
          error: function(error) {
//            if (config.videoRoomHandler) config.videoRoomHandler.alive = false;
            Janus.error(error);
            config.onError(error);
            reject(error);
          },
          destroyed: function() {
            console.log('Destroyed');
          },
          iceServers: config.iceServers,
        }
      );
    } catch ( err ) {
      reject(err);
    }
  });
}

function newRemoteFeed(id, display, audio, video) {
  // A new feed has been published, create a new plugin handle and attach to it as a subscriber
  var remoteFeed = null;
  config.janus.attach(
    {
      plugin: "janus.plugin.videoroom",
      opaqueId: config.opaqueId,
      slowLink: config.slowLink,
      success: function(pluginHandle) {
        remoteFeed = pluginHandle;
        remoteFeed.simulcastStarted = false;
        Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
        Janus.log("  -- This is a subscriber");
        // We wait for the plugin to send us an offer
        var listen = {
          "request": "join",
          "room": config.room,
          "ptype": "subscriber",
          "feed": id,
          "private_id": config.mypvtid
        };
        if (config.token) listen.token = config.token;
        // In case you don't want to receive audio, video or data, even if the
        // publisher is sending them, set the 'offer_audio', 'offer_video' or
        // 'offer_data' properties to false (they're true by default), e.g.:
        // 		listen["offer_video"] = false;
        // For example, if the publisher is VP8 and this.is Safari, let's avoid video
        if (video !== "h264" && Janus.webRTCAdapter.browserDetails.browser === "safari") {
          if (video) {
            video = video.toUpperCase()
          }
          Janus.debug("Publisher is using " + video + ", but Safari doesn't support it: disabling video");
          listen["offer_video"] = false;
        }
        listen["offer_data"] = true;
        remoteFeed.videoCodec = video;
        remoteFeed.send({
          "message": listen
        });

        // Setup DataChannel
        var body = {
          "request": "setup",
        }
        if (config.token) body.token = config.token;
        pluginHandle.send({
          "message": body
        });

      },
      error: function(error) {
        Janus.error("  -- Error attaching plugin...", error);
        config.onError("Error attaching plugin... " + error);
      },
      onmessage: function(msg, jsep) {
        Janus.debug(" ::: Got a message (subscriber) :::");
        Janus.debug(msg);
        config.videoRoomHandler.alive = true;
        var event = msg["videoroom"];
        Janus.debug("Event: " + event);
        if (msg["error"] !== undefined && msg["error"] !== null) {
          config.onError(msg["error"]);
        } else if (event != undefined && event != null) {
          if (event === "attached") {
            // Subscriber created and attached
            for (var i = 1; i < MaxStreams; i++) {
              if (config.feeds[i] === undefined || config.feeds[i] === null) {
                config.feeds[i] = remoteFeed;
                remoteFeed.rfindex = i;
                break;
              }
            }
            remoteFeed.rfid = msg["id"];
            remoteFeed.rfdisplay = msg["display"];
            if (remoteFeed.spinner === undefined || remoteFeed.spinner === null) {
				
				 //WTF? TODO
              //var target = document.getElementById('videoremote' + remoteFeed.rfindex);
            // Spinner
			  //var remoteFeed.spinner = new Spinner().spin();
				//target.appendChild(remoteFeed.spinner.el);
            } else {
              remoteFeed.spinner.spin();
            }
            Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") in room " + msg["room"]);
          } else if (event === "event") {
            // Check if we got an event on a simulcast-related event from publisher
            var substream = msg["substream"];
            var temporal = msg["temporal"];
            if ((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
              if (!remoteFeed.simulcastStarted) {
                remoteFeed.simulcastStarted = true;
                // Add some new buttons
                this.addSimulcastButtons(remoteFeed.rfindex, remoteFeed.videoCodec === "vp8");
              }
              // We just received notice that there's been a switch, update the buttons
              this.updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
            }
          } else {
            // What has just happened?
          }
        }
        if (jsep !== undefined && jsep !== null) {
          Janus.debug("Handling SDP as well...");
          Janus.debug(jsep);
          // Answer and attach
          remoteFeed.createAnswer(
            {
              jsep: jsep,
              // Add data:true here if you want to subscribe to datachannels as well
              // (obviously only works if the publisher offered them in the first place)
              media: {
                audioSend: false,
                videoSend: false,
                data: true,
              }, // We want recvonly audio/video
              success: function(jsep) {
                Janus.debug("Got SDP!");
                Janus.debug(jsep);
                var body = {
                  "request": "start",
                  "room": config.room
                };
                if (config.token) body.token = config.token;
                remoteFeed.send({
                  "message": body,
                  "jsep": jsep
                });
              },
              error: function(error) {
                Janus.error("WebRTC error:", error);
                config.onError("WebRTC error... " + JSON.stringify(error));
              }
            });
        }
      },
      webrtcState: function(on) {
        Janus.log("Janus says this.WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
      },
      onlocalstream: function(stream) {
        // The subscriber stream is recvonly, we don't expect anything here
      },
      ondata: function(data) {
        try {
          data = JSON.parse(data);
          config.onMessage(data);
        } catch ( err ) {
          config.onMessage({
            error: `Failed to parse JSON : ${err}`
          });
        }
      },
      onremotestream: function(stream) {
        Janus.debug("Remote feed #" + remoteFeed.rfindex);
        
        config.remotestreams[remoteFeed.rfindex] = {}
        config.remotestreams[remoteFeed.rfindex].index = remoteFeed.rfindex;
        config.remotestreams[remoteFeed.rfindex].feedId = remoteFeed.getId();
        config.remotestreams[remoteFeed.rfindex].stream = stream;
		config.remotestreams[remoteFeed.rfindex].feed = remoteFeed;
        config.onRemoteJoin(remoteFeed.rfindex, remoteFeed.rfdisplay, remoteFeed.getId(), id);
        if (config.onVolumeMeterUpdate) {
          let ctx = new AudioContext();
          let meter = volumeMeter(ctx, { tweenIn:2, tweenOut:6, skip:config.volumeMeterSkip}, (volume) => {
            config.onVolumeMeterUpdate(remoteFeed.rfindex, volume);
          });
          let src = ctx.createMediaStreamSource(config.remotestreams[remoteFeed.rfindex].stream);
          src.connect(meter);
          config.remotestreams[remoteFeed.rfindex].stream.onended = meter.stop.bind(meter);
          
        }
      },
      oncleanup: function() {
        Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
        if (remoteFeed.spinner !== undefined && remoteFeed.spinner !== null) {
          remoteFeed.spinner.stop();
        }
        remoteFeed.spinner = null;
        delete (config.remotestreams[remoteFeed.rfindex]);
        config.onRemoteUnjoin(remoteFeed.rfindex, remoteFeed.rfdisplay);
      }
    });
}



var doSimulcast = (getQueryStringValue("simulcast") === "yes" || getQueryStringValue("simulcast") === "true");

class Room {

  constructor(options) {
    // Make sure the entire configuration get flushed first
    config = {
      remotestreams: {},
      feeds: [],
      bitrateTimer: [],
	  remoteaudiostreams: {},
	  feedsaudio : []
    }
    window.remotestreams = config.remotestreams;
    // Assign the values
    config.debug = options.debug || false,
    config.server = options.server || null;
    config.publishers = options.publishers || null; 
    config.opaqueId = "videoroomtest-" + Janus.randomString(12);
    config.room = options.room || null;
    config.adapter = options.adapter || null;
    config.publishOwnFeed = options.publishOwnFeed || false;
    config.extensionId = options.extensionId || null;
    config.token = options.token || null;
    config.useRecordPlugin = options.useRecordPlugin || false;
    config.useAudioBridgePlugin = options.useAudioBridgePlugin || false;
    config.volumeMeterSkip = options.volumeMeterSkip || 0;
    // Events
    config.slowLink = options.slowLink || null;
    config.onLocalJoin = options.onLocalJoin || null;
    config.onFilterName = options.onFilterName || null;
    config.onRemoteJoin = options.onRemoteJoin || null;
    config.onRemoteJoinAudio = options.onRemoteJoinAudio || null;
    config.onRemoteUnjoin = options.onRemoteUnjoin || null;
    config.onRemoteUnjoinAudio = options.onRemoteUnjoinAudio || null;
    config.onRecordedPlay = options.onRecordedPlay || null;
    config.onMessage = options.onMessage || null;
    config.onDestroyed = options.onDestroyed || null;
    config.onVolumeMeterUpdate = options.onVolumeMeterUpdate || null;
    config.onError = options.onError || null;
    config.onWarning = options.onWarning || null;
    config.iceServers = options.iceServers || [{
      urls: "stun:stun.l.google.com:19302"
    }];
  }


  init() {
    return new Promise((resolve, reject) => {
      try {
        if (!config.server) {
          throw 'server value is needed.';
        }
        Janus.init({
          debug: config.debug,
	  adapter:  config.adapter || null,
          extensionId: config.extensionId,
          callback: function() {
            start()
              .then(() => {
                resolve();
              })
              .catch((err) => {
                reject(err);
              });
          }
        });
      } catch ( err ) {
        reject(err);
      }
    });
  }

  stop() {
    if (config.janus) {
      this.stopRecording();
      // Make sure the webcam and microphone got turned off first
      if (config.mystream) {
        let tracks = config.mystream.getTracks();
        for (let i in tracks) {
          if (tracks[i]) {
            tracks[i].stop();
          }
        }
		
      }
      // Destroy  remote the session
						var remoteFeed = null;
                        for (var i = 1; i < MaxStreams; i++) {
                          if (config.feeds[i] != null && config.feeds[i] != undefined ) {
                            config.feeds[i].stop();
							config.feeds[i].detach();
							Janus.debug("Feed " + i + " (" + (config.feeds[i].rfdisplay || 'null') + ") detaching");
                            config.feeds[i] = null;  
                          }
                        if (config.feedsaudio[i] != null && config.feedsaudio[i] != undefined ) {
							config.feedsaudio[i].stop();
                            config.feedsaudio[i].detach();
							
                            config.feedsaudio[i] = null;  
							
                          }

                        }
                        
	// Destroy  my the session
      config.janus.destroy();
    }
  }

  register(options) {
    new Promise((resolve, reject) => {
      try {
        if (!options || (options && !options.username)) {
          throw 'username value is needed.';
        }
        if (!options || (options && !options.room)) {
          throw 'room value is needed.';
        }
        config.username = options.username || config.username;
        config.room = options.room || config.room;
        var register = {
          "request": "join",
          "room": config.room,
          "ptype": "publisher",
          "display": config.username
        };
        if (config.token) register.token = config.token;
        config.videoRoomHandler.send({
          "message": register,
		  success: function(){
				
		    }
        });
/*	if (config.useAudioBridgePlugin) {
            config.audioBridgeHandler.send({
	      "message": register
    	    });
	}*/
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }

  registerAudio(options) {
    new Promise((resolve, reject) => {
      try {
		   if (! useAudioBridgePlugin) return;
        if (!options || (options && !options.username)) {
          throw 'username value is needed.';
        }
        if (!options || (options && !options.room)) {
          throw 'room value is needed.';
        }
        config.username = options.username || config.username;
        config.room = options.room || config.room;
        var register = {
          "request": "join",
          "room": config.room,
//          "ptype": "publisher",
          "display": config.username,
		  "muted":true,
        };
        if (config.token) register.token = config.token;
            config.audioBridgeHandler.send({
	      "message": register
    	    });
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }

  toggleMuteAudio() {
    return new Promise((resolve, reject) => {
      try {
        let muted = config.videoRoomHandler.isAudioMuted();
        Janus.log((muted ? "Unmuting" : "Muting") + " local stream...");
        if (muted) {
          config.videoRoomHandler.unmuteAudio();
        } else {
          config.videoRoomHandler.muteAudio();
        }
        resolve(config.videoRoomHandler.isAudioMuted());
      } catch ( err ) {
        reject(err);
      }
    });
  }

  toggleMuteVideo() {
    return new Promise((resolve, reject) => {
      try {
        let muted = config.videoRoomHandler.isVideoMuted();
        Janus.log((muted ? "Unmuting" : "Muting") + " local stream...");
        if (muted) {
          config.videoRoomHandler.unmuteVideo();
        } else {
          config.videoRoomHandler.muteVideo();
        }
        resolve(config.videoRoomHandler.isVideoMuted());
      } catch ( err ) {
        reject(err);
      }
    });
  }
 toggleRemoteVideo() {
	 
	 return new Promise((resolve, reject) => {
      let videoStopped = false;
      let audioStopped = false;
      if (!config.mystream) {
        reject('No local stream.');
        return;
      } else {
        if (config.mystream.getVideoTracks().length > 0) {
			for (let i in config.mystream.getVideoTracks()) {
          if (tracks[i]) {
            tracks[i].stop();
			videoStopped = tracks[i].readyState === 'ended';
          }
		  
          
        }
	  } }
      /*if (config.publishOwnFeed) {
        publishOwnFeed({
          audioSend: !audioStopped,
          videoSend: videoStopped,
          replaceVideo: videoStopped,
          replaceAudio: audioStopped,
        }, () => {
          resolve(!videoStopped)
        });
      } else {
        resolve(!videoStopped)
      }*/
    });
	
 }
  toggleVideo() {
    return new Promise((resolve, reject) => {
      let videoStopped = false;
      let audioStopped = false;
      if (!config.mystream) {
        reject('No local stream.');
        return;
      } else {
        if (config.mystream.getVideoTracks().length > 0) {
          videoStopped = config.mystream.getVideoTracks()[0].readyState === 'ended';
        }
        if (config.mystream.getAudioTracks().length > 0) {
          audioStopped = config.mystream.getAudioTracks()[0].readyState === 'ended';
        }
      }
      if (!videoStopped) {
        config.mystream.getVideoTracks()[0].stop();
      }
      if (config.publishOwnFeed) {
        publishOwnFeed({
          audioSend: !audioStopped,
          videoSend: videoStopped,
          replaceVideo: videoStopped,
          replaceAudio: audioStopped,
        }, () => {
          resolve(!videoStopped)
        });
      } else {
        resolve(!videoStopped)
      }
    });
  }

  sendMessage(data) {
    return new Promise((resolve, reject) => {
      try {
		   if (config.videoRoomHandler)
        config.videoRoomHandler.data({
          text: JSON.stringify(data),
          success: function() {
            resolve(data);
          },
          error: function(err) {
            reject(err);
          },
        });
      } catch ( err ) {
        reject(err)
      }
    });
  }

  attachStream(target, index) {
    return new Promise((resolve, reject) => {
      try {
        if (index === 0) {
          Janus.attachMediaStream(target, config.mystream);
        } else {
          Janus.attachMediaStream(target, config.remotestreams[index].stream);
		  if (remotestreams[index].feed && ! remotestreams[index].feed.spinner ) {
			  
				//var spinner = remotestreams[index].feed.spinner = new Spinner({color:'#fff', lines: 12}).spin();
			//	target.parentNode.appendChild(spinner.el);
		  }
        }
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }
  attachAudioStream(target, index) {
    return new Promise((resolve, reject) => {
      try {
        if (index === 0) {
          Janus.attachMediaStream(target, config.mystream);
        } else {
          Janus.attachMediaStream(target, config.remoteaudiostreams[index].stream);
        }
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }

  isShareScreenStream(index) {
    return new Promise((resolve, reject) => {
      var res = false;
      var tracks;
      try {
        if (index === 0) {
          tracks = config.mystream.getVideoTracks()
        } else if (config.remotestreams[index].stream) {
          tracks = config.remotestreams[index].stream.getVideoTracks()
        }
        if (tracks && tracks[0] && tracks[0].label &&
          // Video tracks from webcam got labeled as "Integrated Camera" or "iSight"
          // TODO collect this label value from various browsers/devices
          (tracks[0].label.toLowerCase().indexOf('monitor') > -1 || // Firefox, "Primary Monitor"
          tracks[0].label.toLowerCase().indexOf('screen') > -1 || // Chrome, "screen:0:0"
          tracks[0].label.toLowerCase().indexOf('window:') > -1 // Chrome, "window:37483", window capture
          )
        ) {
          res = true;
        }
        resolve(res)
      } catch ( err ) {
        reject(err);
      }
    });
  }

  attachRecordedPlayStream(target) {
    return new Promise((resolve, reject) => {
      try {
        Janus.attachMediaStream(target, config.recordedplaystream);
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }

  shareScreen() {
    return new Promise((resolve, reject) => {
      if (Janus.webRTCAdapter.browserDetails.browser === 'safari') {
        reject(new Error('No video support for Safari browser.'));
	  if(!Janus.isExtensionEnabled()) {
		reject(new Error("You're using Chrome but don't have the screensharing extension installed: click <b><a href='https://chrome.google.com/webstore/detail/janus-webrtc-screensharin/hapfgfdkleiggjjpfpenajgdnfckjpaj' target='_blank'>here</a></b> to do so"));
		
	}
      }
      if (!config.publishOwnFeed) {
        return reject();
      }
      try {
        unpublishOwnFeed()
        setTimeout(() => {
          shareScreen((err) => {
            if (err) {
              reject(err)
              return;
            }
            resolve();
          });
        }, 500);
      } catch ( err ) {
        reject(err);
      }
    });
  }

  stopShareScreen() {
    return new Promise((resolve, reject) => {
      if (!config.publishOwnFeed) {
        return reject();
      }
      try {
        unpublishOwnFeed()
        setTimeout(() => {
          publishOwnFeed({
            audioSend: true,
            replaceVideo: true,
            replaceAudio: true,
          }, () => {
            resolve()
          });
        }, 500);
      } catch ( err ) {
        reject(err);
      }
    });
  }

  publishOwnFeed(opts, cb) {
    publishOwnFeed(opts, cb);
  }

  unpublishOwnFeed() {
    unpublishOwnFeed();
  }

  newRemoteFeed(id, display, audio, video) {
    newRemoteFeed(id, display, audio, video);
  }
  newRemoteFeedAudio(id, display, audio) {
    newRemoteFeedAudio(id, display, audio);
  }

  createRoom(options) {
    return new Promise((resolve, reject) => {
      try {
        options = options || {}
        config.room = options.room || null
        // TODO handle room's secret
        var body = {
          "request": "create",
          "room": config.room,
	  "publishers": config.publishers || 10,
        };
	alert(body);
        if (config.token) body.token = config.token;
        if (config.secret) body.secret = config.secret;
        config.videoRoomHandler.send({
          "message": body,
        });
        // TODO catch the response
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }
  createAudioRoom(options) {
    return new Promise((resolve, reject) => {
      try {
        options = options || {}
        config.room = options.room || null
        // TODO handle room's secret
        var body = {
          "request": "create",
          "room": config.room,
	  "participants": config.publishers || 10,
        };
	alert(body);
        if (config.token) body.token = config.token;
        if (config.secret) body.secret = config.secret;
        config.audioBridgeHandler.send({
          "message": body,
        });
        // TODO catch the response
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }

  removeRoom() {
    return new Promise((resolve, reject) => {
      try {
        // TODO handle room's secret
        var body = {
          "request": "destroy",
          "room": config.room,
        };
        if (config.token) body.token = config.token;
        if (config.secret) body.secret = config.secret;
        config.videoRoomHandler.send({
          "message": body,
        });
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }

  removeAudioRoom() {
    return new Promise((resolve, reject) => {
      try {
        // TODO handle room's secret
        var body = {
          "request": "destroy",
          "room": config.room,
        };
        if (config.token) body.token = config.token;
        if (config.secret) body.secret = config.secret;
        config.AudioBridgeHandler.send({
          "message": body,
        });
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }

  getRecordedList() {
    return new Promise((resolve, reject) => {
      var body = {
        "request": "list"
      };
      Janus.debug("Sending message (" + JSON.stringify(body) + ")");
      config.recordPlayHandler.send({
        "message": body,
        success: function(result) {
          resolve(result);
        },
        error: function(err) {
          reject(err);
        }
      });
    });
  }

  getRoomList() {
    return new Promise((resolve, reject) => {
      var body = {
        "request": "list"
      };
      Janus.debug("Sending message (" + JSON.stringify(body) + ")");
        if (config.token) body.token = config.token;
//        if (config.secret) body.secret = config.secret;
        config.videoRoomHandler.send({
        "message": body,
        success: function(result) {
          resolve(result);
        },
        error: function(err) {
          reject(err);
        }
      });
    });
  }

  getRoomParticipants(roomId) {
    return new Promise((resolve, reject) => {
      var body = {
        "request": "listparticipants"
      };
      Janus.debug("Sending message (" + JSON.stringify(body) + ")");
        if (config.token) body.token = config.token;
        if (roomId) body.room = roomId;
//        if (config.secret) body.secret = config.secret;
        config.videoRoomHandler.send({
        "message": body,
        success: function(result) {
          resolve(result);
        },
        error: function(err) {
          reject(err);
        }
      });
    });
  }

  stopPlayback() {
    return stopPlayback()
  }

  recordedPlayback(recordId) {
    return new Promise((resolve, reject) => {
      var play = {
        "request": "play",
        "id": parseInt(recordId, 10)
      };
      if (config.recordedplaystream) {
        let tracks = config.recordedplaystream.getTracks();
        for (let i in tracks) {
          if (tracks[i]) {
            tracks[i].stop();
          }
        }
        config.recordedplaystream = null;
        stopPlayback()
          .then(() => {
            config.recordPlayHandler.send({
              "message": play,
              success: function() {
                resolve();
              },
              error: function(err) {
                reject(err);
              }
            });
          })
          .catch((err) => {
            reject(err);
          });
      } else {
        config.recordPlayHandler.send({
          "message": play,
          success: function() {
            resolve();
          },
          error: function(err) {
            reject(err);
          }
        });
      }
    });
  }

  startRecording(options) {
    return startRecording(options)
  }

  stopRecording() {
    return new Promise((resolve, reject) => {
      if (config.recordPlayHandler) {
        var stop = {
          "request": "stop"
        };
        config.recordPlayHandler.send({
          "message": stop,
          success: function() {
            resolve();
          },
          error: function(err) {
            reject(err);
          }
        });
      }
    });
  }
  getStream(streamIndex) {
    return new Promise((resolve, reject) => {
      try {
        if ('' + streamIndex === '0') {
          resolve(config.mystream);
        } else {
          if (config.remotestreams[streamIndex]) {
            resolve(config.remotestreams[streamIndex].stream);
          } else {
            reject(new Error('No such stream index: ' + streamIndex));
          }
        }
      } catch(e) {
        reject(e);
      }
    });
  }
  getStreamBitrate(streamIndex) {
    return new Promise((resolve, reject) => {
      try {
        if (config.remotestreams[streamIndex] && config.remotestreams[streamIndex].feed && ''+streamIndex !== '0') {
          resolve(config.remotestreams[streamIndex].feed.getBitrate());
        } else if (config.videoRoomHandler && ''+streamIndex === '0') {
          resolve(config.videoRoomHandler.alive ? true : false);
        } else {
          reject(new Error('No such stream index: ' + streamIndex));
        }
      } catch(e) {
        reject(e);
      }
    });
  }

  // TODO Fix me.
  // Helpers to create Simulcast-related UI, if enabled
  addSimulcastButtons(feed, temporal) {}

  updateSimulcastButtons(feed, substream, temporal) {}

}

module.exports = Room;
