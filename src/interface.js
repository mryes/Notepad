(function()
{
	"use strict";

	var makeNote = notepad.makeNote;
	var notesFromIntervals = notepad.notesFromIntervals;

	var gridShades = [230, 210, 250, 230];

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
		var firstVisibleColumn = 0;
		var lastVisibleRow = 0;

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
			for (var i=0; i<notes.length; i++)
			{
				var fullValue = notes[i].pitch.fullValue();
				var duration = notes[i].durationInBeats;
				var startTime = notes[i].startTimeInBeats;
				if (fullValue < lastVisibleRow ||
					fullValue > lastVisibleRow + gridColumns)
					continue;
				var bottomCell = canvasHeight - noteHeight;
				var x = startTime * noteWidth;
				var y = bottomCell - ((fullValue - lastVisibleRow) * noteHeight);
				var w = duration * noteWidth;
				var h = noteHeight;
				ctx.fillStyle = ctx.createLinearGradient(x, y, x, y+h);
				ctx.fillStyle.addColorStop(0, "gray");
				ctx.fillStyle.addColorStop(1, "black");
				ctx.fillRect(x, y, w, h);
			}
		};

		var draw = function(notes)
		{
			ctx.fillStyle = colorStyle(255, 255, 255);
			ctx.fillRect(0, 0, canvasWidth, canvasHeight);
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
		var testChord = notesFromIntervals(notepad.chords.diminishedSeventh, makeNote(0, 0));
		for (var i=0; i<20; i+=2)
		{
			var length = Math.round(Math.random() * 3 + 0.5);
			for (var j = 0; j < testChord.length; j++)
			{
				pad.addNote(testChord[j], i, length);
			}
			i += length;
		}
	};

})();