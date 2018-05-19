import JSZip from 'jszip';

require('aframe');
require('./shaders/skyGradient.js');
var url = require('url');
var parsedURL = url.parse(document.location.toString(), true);
var songURL = undefined;
if (parsedURL.query.songlocation) {
    songURL = parsedURL.query.songlocation;
} else {
    alert("Please specify a song URL via the 'songlocation' query string parameter!");
};

var songParser = fetch(songURL).then(function(x){return JSZip.loadAsync(x.blob())});

var setTitle = function(title){
    document.getElementById('song_title').setAttribute('text', 'value', title.toString());
};
var showError = function(err){
    console.error(err);
    setTitle(err);
};

var getFileInZip = function(jszip, filename) {
    return new Promise(function(resolve, reject){
        for (var i in jszip.files) {
            var file = jszip.files[i];
            if (file.name.split('/').pop().toLowerCase() === filename.toLowerCase()) {
                resolve(file);
                break;
            }
        }
        reject('file not found');
    });
};

var BOXSIZE = 0.33;
var OFFSET_Y = 1;
var OFFSET_Z = -7;
var RED = '#f00';
var BLUE = '#00f';
var infoMetaData = undefined;
var songMetaData = undefined;

var getPositionForNote = function(note) {
    var time = note._time * 4;
    return {
        y: (BOXSIZE * note._lineLayer) + OFFSET_Y,
        x: BOXSIZE * note._lineIndex - BOXSIZE * 2,
        z: (-time + OFFSET_Z) * BOXSIZE
    }
}

var playing = false;

var displayTrack = function(trackdetails) {
    console.log(trackdetails)
    var noteElements = trackdetails._notes.map(note => {
        var box = document.createElement('a-box');
        box.setAttribute('position', getPositionForNote(note));
        box.setAttribute('scale', `${BOXSIZE} ${BOXSIZE} ${BOXSIZE}`);
        box.setAttribute('material', 'color', note._type == 0 ? RED : BLUE)
        box.setAttribute('material', 'src', '#dir_' + note._cutDirection);
        return box;
    });

    noteElements.forEach(element => {
        document.getElementById('notes').appendChild(element);
    });
};

AFRAME.registerComponent('game-track', {
    init: function() {
    },
    tick: function(time, timeDelta) {
        if (playing) {
            var timedelta_sec = timeDelta / 1000;
            var move_in_1_minute = ((songMetaData._beatsPerMinute * 4) * BOXSIZE);
            var move = move_in_1_minute / 60 * timedelta_sec;
            var pos = this.el.getAttribute('position');
            pos.z += move;
            this.el.setAttribute('position', pos);
        }
    }
});

AFRAME.registerComponent('remove-hand-controls', {
    init: function() {},
    tick: function(time) {
        // remove default hand model
        var obj3d = this.el.getObject3D('mesh');
        if (obj3d) {
            this.el.removeObject3D('mesh');
            this.el.removeAttribute('remove-hand-controls'); // once default hand model is removed; remove this component
        }
    }
});

songParser.then(function(jszip){
    getFileInZip(jszip, 'info.json').then(function(file){
        return file.async('text').then(function(filedetails){
            var filejson = JSON.parse(filedetails);
            var title = `${filejson.songName} - ${filejson.songSubName} (by ${filejson.authorName})`;
            setTitle(title);
            console.log(filejson);
            infoMetaData = filejson;
            var trackjsonfilename = filejson.difficultyLevels[filejson.difficultyLevels.length-1].jsonPath;
            var audiofilename = filejson.difficultyLevels[filejson.difficultyLevels.length-1].audioPath;
            console.log("Loading... " + trackjsonfilename + ' // ' + audiofilename);
            getFileInZip(jszip, trackjsonfilename).then(function(trackjsonfile){
                return trackjsonfile.async('text').then(function(filedetails){
                    var trackjson = JSON.parse(filedetails);
                    songMetaData = trackjson;
                    displayTrack(trackjson);
                });
            }).catch(showError);
            getFileInZip(jszip, audiofilename).then(function(audiofile){
                audiofile.async('base64').then(function(b64data){
                    var audioElem = document.createElement('audio');
                    audioElem.setAttribute('id', 'audio');
                    audioElem.setAttribute('autoplay', true);
                    var format = audiofilename.toLowerCase().endsWith('mp3') ? 'mp3' : 'ogg';
                    audioElem.setAttribute('src', `data:audio/${format};base64,${b64data}`);
                    audioElem.onplay = function() {
                        playing = true;
                    };
                    document.body.appendChild(audioElem);
                    audioElem.play();
                }).catch(showError);
            })
        });
    }).catch(showError);
}).catch(showError);


/*
  Define custom behaviour for Hot Module Replacement
  A-Frame exposes no API for unregistering components, unfortunately.
  Therefore, we'll just reload the entire page whenever:
  * This module is about to be replaced
  * Any of this module's dependencies were just updated
  An error is thrown in both functions to prevent this module from getting reloaded in a split-second.
*/
if (module.hot) {
    module.hot.dispose(function() {
      // module is about to be replaced
      window.location.reload();
      throw new Error('Hot Module Reloading not supported!');
    });
    module.hot.accept(function() {
      // module or one of its dependencies was just updated
      window.location.reload();
      throw new Error('Hot Module Reloading not supported!');
    });
}