(function()
{
	"use strict";

	var makeNote = notepad.makeNote;
	var notesFromIntervals = notepad.notesFromIntervals;

	var makeVector = notepad.namedTuple(["x", "y"], function(obj)
	{
		obj.equals = function(other)
		{
			return obj.x === other.x && obj.y === other.y;
		};
	});

	var insideRect = function(point, rect)
	{
		return point.x > rect.x1 && point.x < rect.x2 &&
			point.y > rect.y1 && point.y < rect.y2;
	};

	var makePadView = function(id)
	{
		var pad;

		var canvas = document.getElementById(id);
		var ctx = canvas.getContext("2d");

		var canvasWidth = parseInt(canvas.getAttribute("width"));
		var canvasHeight = parseInt(canvas.getAttribute("height"));
		var canvasGridStart = makeVector(0, 0);
		var canvasGridSize = makeVector(
			canvasWidth - canvasGridStart.x,
			canvasHeight - canvasGridStart.y);
		var gridColumns = 30;
		var gridRows = 20;
		var noteWidth = canvasGridSize.x / gridColumns;
		var noteHeight = canvasGridSize.y / gridRows;
		var gridShades = [230, 210, 250, 230];

		var firstVisibleColumn = 0;
		var lastVisibleRow = 0;

		var pointerLocation = makeVector(-1, -1);
		var highlightedCell = makeVector(-1, -1);

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
					var ctxPosition = makeVector(
						canvasGridStart.x + x * noteWidth,
						canvasGridStart.y + y * noteHeight);
					ctx.fillStyle = colorStyleFromShade(gridShades[0]);
					ctx.fillRect(
						ctxPosition.x, ctxPosition.y,
						noteWidth, noteHeight);
					ctx.fillStyle = colorStyleFromShade(gridShades[1]);
					ctx.fillRect(
						ctxPosition.x + noteWidth, ctxPosition.y,
						noteWidth, noteHeight);
					ctx.fillStyle = colorStyleFromShade(gridShades[2]);
					ctx.fillRect(
						ctxPosition.x, ctxPosition.y + noteHeight,
						noteWidth, noteHeight);
					ctx.fillStyle = colorStyleFromShade(gridShades[3]);
					ctx.fillRect(
						ctxPosition.x + noteWidth, ctxPosition.y + noteHeight,
						noteWidth, noteHeight);
				}
			}
		};

		var drawNotes = function(notes)
		{
			var pointingAtNote = false;

			for (var i=0; i<notes.length; i++)
			{
				var fullValue = notes[i].pitch.fullValue();
				var duration = notes[i].durationInBeats;
				var startTime = notes[i].startTimeInBeats;
				if (fullValue < lastVisibleRow ||
					fullValue > lastVisibleRow + gridColumns)
					continue;
				var bottomCell = canvasHeight - noteHeight - canvasGridStart.y;
				var x = canvasGridStart.x + startTime * noteWidth;
				var y = canvasGridStart.y + bottomCell -
					((fullValue - lastVisibleRow) * noteHeight);
				var w = duration * noteWidth;
				var h = noteHeight;
				ctx.fillStyle = ctx.createLinearGradient(x, y, x, y+h);
				ctx.fillStyle.addColorStop(0, "gray");
				ctx.fillStyle.addColorStop(1, "black");
				ctx.fillRect(x, y, w, h);

				ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
				ctx.lineWidth = 4;
				ctx.setLineDash([1]);
				ctx.beginPath();
				ctx.moveTo(x + w, y + h);
				ctx.lineTo(x + w, y);
				ctx.stroke();
				ctx.setLineDash([]);

				var cellRect = {
					x1: x, y1: y,
					x2: x + w, y2: y + h};
				if (insideRect(pointerLocation, cellRect))
				{
					ctx.fillStyle = "rgba(200, 255, 0, 0.5)";
					ctx.fillRect(x, y, w, h);
					pointingAtNote = true;
				}
			}

			if (pointingAtNote)
				ctx.strokeStyle = colorStyle(255, 255, 255);
			else ctx.strokeStyle = colorStyle(0, 0, 0);
			var strokeWidth = noteWidth / 10;
			ctx.lineWidth = strokeWidth;
			ctx.strokeRect(
				highlightedCell.x * noteWidth + strokeWidth*2 ,
				highlightedCell.y * noteHeight + strokeWidth*2,
				noteWidth - strokeWidth*4,
				noteHeight - strokeWidth*4);
		};

		// If draw is called without notes,
		// it will use the notes from last time
		var previousNotes;
		var draw = function(notes)
		{
			ctx.fillStyle = colorStyle(255, 255, 255);
			ctx.fillRect(0, 0, canvasWidth, canvasHeight);
			drawGrid();
			if (notes !== undefined)
			{
				drawNotes(notes);
				if (previousNotes === undefined)
					previousNotes = [];
				previousNotes = notes;
			}
			else if (previousNotes !== undefined)
				drawNotes(previousNotes);
		};

		var hasPad = function()
		{
			return typeof pad !== "undefined";
		};

		var onNoteAdded = function(note, allNotes)
		{
			draw(allNotes);
		};

		var cellFromCanvasPosition = function(x, y)
		{
			var locationOnGrid = makeVector(
				x - canvasGridStart.x,
				y - canvasGridStart.y);
			return makeVector(
				Math.floor(locationOnGrid.x / noteWidth),
				Math.floor(locationOnGrid.y / noteHeight));
		};

		canvas.addEventListener("mousemove", function(event)
		{
			var mouseX = event.clientX - canvas.getBoundingClientRect().left;
			var mouseY = event.clientY - canvas.getBoundingClientRect().top;
			highlightedCell = cellFromCanvasPosition(mouseX, mouseY);
			pointerLocation = makeVector(mouseX, mouseY);
			draw();
		});

		canvas.addEventListener("mouseleave", function()
		{
			highlightedCell = makeVector(-1, -1);
			draw();
		});

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
		var testChord = notesFromIntervals(notepad.chords.majorNinth, makeNote(0, 0));
		for (var i=0; i<20;)
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