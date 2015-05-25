(function()
{
	"use strict";

	var makeNote = notepad.makeNote;
	var notesFromIntervals = notepad.notesFromIntervals;

	var gridShades = [200, 180, 230, 200];

	var makePadView = function(id)
	{
		var pad;
		var canvas = document.getElementById(id);
		var ctx = canvas.getContext("2d");
		var canvasWidth = parseInt(canvas.getAttribute("width"));
		var canvasHeight = parseInt(canvas.getAttribute("height"));
		var gridColumns = 30;
		var gridRows = 20;
		var noteWidth = canvasWidth / gridColumns;
		var noteHeight = canvasHeight / gridRows;
		var lastVisibleRow = 30;
		var firstVisibleColumn = 0;

		var colorStyle = function(r, g, b)
		{
			return "rgb(" + r + "," + g + "," + b + ")";
		};

		var colorStyleFromShade = function(shade)
		{
			return colorStyle(shade, shade, shade);
		};

		var drawGrid = function()
		{
			for (var y=0; y<gridRows; y+=2)
			{
				for (var x=0; x<gridColumns; x+=2)
				{
					var ctxPositionX = x * noteWidth;
					var ctxPositionY = y * noteHeight;
					ctx.fillStyle = colorStyleFromShade(gridShades[0]);
					ctx.fillRect(
						ctxPositionX, ctxPositionY,
						noteWidth, noteHeight);
					ctx.fillStyle = colorStyleFromShade(gridShades[1]);
					ctx.fillRect(
						ctxPositionX + noteWidth, ctxPositionY,
						noteWidth, noteHeight);
					ctx.fillStyle = colorStyleFromShade(gridShades[2]);
					ctx.fillRect(
						ctxPositionX, ctxPositionY + noteHeight,
						noteWidth, noteHeight);
					ctx.fillStyle = colorStyleFromShade(gridShades[3]);
					ctx.fillRect(
						ctxPositionX + noteWidth, ctxPositionY + noteHeight,
						noteWidth, noteHeight);
				}
			}
		};

		var drawNotes = function(notes)
		{
			ctx.fillStyle = colorStyle(0, 0, 0);
			for (var i=0; i<notes.length; i++)
			{
				var fullValue = notes[i].pitch.fullValue();
				var duration = notes[i].durationInBeats;
				var startTime = notes[i].startTimeInBeats;
				ctx.fillRect(
					startTime * noteWidth,
					(canvasHeight - noteHeight) - fullValue * noteHeight,
					duration * noteWidth,
					noteHeight);
			}
		};

		var draw = function(notes)
		{
			ctx.fillStyle = colorStyle(255, 255, 255);
			ctx.clearRect(0, 0, canvasWidth, canvasHeight);
			drawGrid();
			if (notes !== undefined)
				drawNotes(notes);
		};

		var hasPad = function()
		{
			return typeof pad !== "undefined";
		};

		var onNoteAdded = function(note, allNotes)
		{
			draw(allNotes);
		};

		draw();

		return {
			draw: draw,
			get pad()  { return pad; },
			set pad(newPad)
			{
				pad = newPad;
				pad.onNoteAdded.push(onNoteAdded);
			},
			hasPad: hasPad
		};
	};

	var makePad = function()
	{
		var notes = [];
		var tonicNote = makeNote(0, 4);

		// parameters: (note, allNotes)
		var onNoteAdded = [];

		// parameters: (tonic)
		var onTonicChanged = [];

		var addNote = function(pitch, startTimeInBeats, durationInBeats)
		{
			var note = {
				pitch: pitch,
				startTimeInBeats: startTimeInBeats,
				durationInBeats: durationInBeats};
			notes.push(note);
			for (var i=0; i<onNoteAdded.length; i++)
				onNoteAdded[i](note, notes);
		};

		var addNotes = function(notes)
		{
			for (var i=0; i<notes.length; i++)
				addNote(
					notes[i].pitch,
					notes[i].startTimeInBeats,
					notes[i].durationInBeats);
		};

		return Object.freeze(
		{
			addNote: addNote, addNotes: addNotes,
			onNoteAdded: onNoteAdded,
			onTonicChanged: onTonicChanged,
			get tonic() { return tonicNote; },
			set tonic(newTonic)
			{
				tonicNote = newTonic;
				for (var i=0; i<onTonicChanged.length; i++)
					onTonicChanged[i](tonicNote);
			}
		});
	};

	window.onload = function()
	{
		var pad = makePad();
		var padView = makePadView("interface");
		padView.pad = pad;
		var testChord = notesFromIntervals(notepad.chords.minor, makeNote(0, 0));
		for (var i=0; i<testChord.length; i++)
		{
			console.log(testChord[i]);
			pad.addNote(testChord[i], 0, 1);
		}
	};

})();