
var Settings = {
 server : (typeof server !== 'undefined' )?server: 'https://mcu1.hvcloud.ru:8089/janus',
 serverApi: (typeof serverApi !== 'undefined' )?serverApi: '',
 roomId : (typeof roomId !== 'undefined' )?roomId: 13371, // Demo room
 usernameFilter : (typeof usernameFilter != 'undefined')? usernameFilter : null,
 username : ((typeof username != 'undefined')? username : 'user'  + (new Date()).valueOf()),
 publishOwnFeed: true,
 isAdmin:(typeof adminToken !== 'undefined' )?true:false, //only show admin buttons
 token: (typeof token !== 'undefined' )?token: '123123',
 adminToken: (typeof adminToken !== 'undefined' )?adminToken: '',
 useAudioBridgePlugin: (typeof useAudioBridgePlugin !== 'undefined' )?useAudioBridgePlugin: false,
 
}

module.exports = Settings;