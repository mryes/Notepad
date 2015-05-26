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

	var makeRect = notepad.namedTuple(["x", "y", "w", "h"]);

	var insideRect = function(point, rect)
	{
		var rectX2 = rect.x + rect.w;
		var rectY2 = rect.y + rect.h;
		return point.x > rect.x && point.x < rectX2 &&
			point.y > rect.y && point.y < rectY2 ;
	};

	var makePadView = function(id)
	{
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

		var firstVisibleColumn = 0;
		var lastVisibleRow = 0;

		var pointerLocation = makeVector(-1, -1);
		var highlightedCell = makeVector(-1, -1);

		var noteRectPending = makeRect(-1, -1, -1, -1);
		var drawingNote = false;

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
			var gridShades = [230, 210, 250, 230];

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

		var rectFromNote = function(note)
		{
			var fullValue = note.pitch.fullValue();
			var duration = note.durationInBeats;
			var startTime = note.startTimeInBeats;
			if (fullValue < lastVisibleRow ||
				fullValue > lastVisibleRow + gridColumns)
				return makeRect(0, 0, 0, 0);
			var bottomCell = canvasHeight - noteHeight - canvasGridStart.y;
			var x = canvasGridStart.x + startTime * noteWidth;
			var y = canvasGridStart.y + bottomCell -
				((fullValue - lastVisibleRow) * noteHeight);
			var w = duration * noteWidth;
			var h = noteHeight;
			return makeRect(x, y, w, h);
		};

		var noteFromRect = function(rect)
		{
			var startTime = (rect.x - canvasGridStart.x) / noteWidth;
			var bottomCell = canvasHeight - noteHeight - canvasGridStart.y;
			var fullValue =
				(bottomCell + canvasGridStart.y +
				lastVisibleRow*noteHeight - rect.y) /
				noteHeight;
			fullValue = Math.floor(fullValue);
			var duration = rect.w / noteWidth;
			return {pitch: notepad.noteFromFullValue(fullValue),
				startTimeInBeats: startTime,
				durationInBeats: duration};
		};

		var drawNoteRect = function(rect)
		{
			var x = rect.x;
			var y = rect.y;
			var w = rect.w;
			var h = rect.h;

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
		};

		var drawNoteHighlight = function(noteRect)
		{
			ctx.fillStyle = "rgba(200, 255, 0, 0.5)";
			ctx.fillRect(
				noteRect.x, noteRect.y,
				noteRect.w, noteRect.h);
		};

		var drawNotes = function(notes)
		{
			var pointingAtNote = false;

			for (var i=0; i<notes.length; i++)
			{
				var noteRect = rectFromNote(notes[i]);

				drawNoteRect(noteRect);

				if (insideRect(pointerLocation, noteRect))
				{
					drawNoteHighlight(noteRect);
					pointingAtNote = true;
				}
				else if (cellFromCanvasPosition(noteRect.x, noteRect.y)
						.equals(highlightedCell))
					pointingAtNote = true;
			}

			drawNoteRect(noteRectPending);
			drawNoteHighlight(noteRectPending);
			if (insideRect(pointerLocation, noteRectPending) ||
				cellFromCanvasPosition(noteRectPending.x, noteRectPending.y)
					.equals(highlightedCell))
				pointingAtNote = true;

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

		var noteAtPosition = function(position)
		{
			if (previousNotes === undefined)
				return { found: false, value: undefined };
			for (var i=0; i<previousNotes.length; i++)
			{
				var noteRect = rectFromNote(previousNotes[i]);
				if (insideRect(position, noteRect))
					return { found: true, value: previousNotes[i] };
			}
			return { found: false, value: undefined };
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

		var mousePositionFromCanvasEvent = function(event)
		{
			var mouseX = event.clientX - canvas.getBoundingClientRect().left;
			var mouseY = event.clientY - canvas.getBoundingClientRect().top;
			return makeVector(mouseX, mouseY);
		};

		canvas.addEventListener("mousedown", function(event)
		{
			if (event.button !== 0)
				return true;
			var mouse = mousePositionFromCanvasEvent(event);
			if (noteAtPosition(mouse).found)
				return true;
			drawingNote = true;
			noteRectPending = makeRect(
				highlightedCell.x * noteWidth,
				highlightedCell.y * noteHeight,
				noteWidth, noteHeight);
			draw();
		});

		window.addEventListener("mouseup", function(event)
		{
			if (event.button !== 0)
				return true;
			if (drawingNote)
			{
				drawingNote = false;
				for (var i=0; i<onNoteRectCreated.length; i++)
					onNoteRectCreated[i](noteFromRect(noteRectPending));
				noteRectPending = makeRect(-1, -1, -1, -1);
				draw();
			}
		});

		canvas.addEventListener("contextmenu", function(event)
		{
			event.preventDefault();

			var mouse = mousePositionFromCanvasEvent(event);

			var note = noteAtPosition(mouse);
			if (!note.found) return false;

			for (var i=0; i<onNoteRectRightClicked.length; i++)
			{
				onNoteRectRightClicked[i](note.value);
			}

			draw();

			return false;
		});

		canvas.addEventListener("mousemove", function(event)
		{
			var mouse = mousePositionFromCanvasEvent(event);
			highlightedCell = cellFromCanvasPosition(mouse.x, mouse.y);
			pointerLocation = makeVector(mouse.x, mouse.y);
			draw();
		});

		canvas.addEventListener("mouseleave", function()
		{
			highlightedCell = makeVector(-1, -1);
			pointerLocation = makeVector(-1, -1);
			draw();
		});

		// parameters: (note)
		var onNoteRectRightClicked = [];

		// parameters: (note)
		var onNoteRectCreated = [];

		var addPadEvents = function(pad)
		{
			pad.onNoteAdded.push(onNoteAdded);
		};

		draw();

		return {
			draw: draw,
			onNoteRectRightClicked: onNoteRectRightClicked,
			onNoteRectCreated: onNoteRectCreated,
			addPadEvents: addPadEvents
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

		var removeNote = function(note)
		{
			var notesEqual = function(a, b)
			{
				return a.pitch === b.pitch &&
					a.startTimeInBeats === b.startTimeInBeats;
			};

			for (var i=0; i<notes.length; i++)
			{
				if (notesEqual(notes[i], note))
				{
					notes.splice(i, 1);
				}
			}
		};

		var addPadViewEvents = function(padView)
		{
			padView.onNoteRectRightClicked.push(removeNote);
			padView.onNoteRectCreated.push(function(note)
			{
				addNote(note.pitch, note.startTimeInBeats, note.durationInBeats);
			});
		};

		return Object.freeze(
		{
			addNote: addNote, addNotes: addNotes,
			addPadViewEvents: addPadViewEvents,
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
		padView.addPadEvents(pad);
		pad.addPadViewEvents(padView);
		var testChord = notesFromIntervals(notepad.chords.majorNinth, makeNote(0, 0));
		for (var i=0; i<20;)
		{
			var length = Math.round(Math.random() * 3 + 0.5);
			for (var j = 0; j < testChord.length; j++)
			{
				pad.addNote(testChord[j], i, length);
			}
			i += length + 1;
		}
	};

})();