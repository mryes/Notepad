(function()
{
	"use strict";

	var makeNote = notepad.makeNote;

	var makeVector = notepad.namedTuple(["x", "y"], function(obj)
	{
		obj.equals = function(other)
		{
			return obj.x === other.x && obj.y === other.y;
		};
	});

	var makeRect = notepad.namedTuple(["x", "y", "w", "h"], function(obj)
	{
		obj.contains = function(point)
		{
			var rectX2 = this.x + this.w;
			var rectY2 = this.y + this.h;
			return point.x > this.x && point.x < rectX2 &&
				point.y > this.y && point.y < rectY2 ;
		};
	});

	var makeColor = notepad.namedTuple(["r", "g", "b", "a"], function(obj)
	{
		if (obj.a === undefined)
			obj.a = 1;

		obj.styleString = function()
		{
			var string = "(" + obj.r + "," + obj.g + "," + obj.b;
			if (obj.a !== 1)
			{
				string = "rgba" + string;
				string += "," + obj.a;
			}
			else string = "rgb" + string;
			string += ")";
			return string;
		};
	});

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

		var drawGrid = function()
		{
			var gridShades = [230, 210, 250, 230];

			var colorStyleFromShade = function(shade)
			{
				return makeColor(shade, shade, shade).styleString();
			};

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

			ctx.strokeStyle = makeColor(255, 255, 255, 0.2).styleString();
			ctx.lineWidth = 4;
			ctx.setLineDash([1]);
			ctx.beginPath();
			ctx.moveTo(x - ctx.lineWidth/2 + w, y + h);
			ctx.lineTo(x - ctx.lineWidth/2 + w, y);
			ctx.stroke();
			ctx.setLineDash([]);
		};

		var drawNoteHighlight = function(noteRect, highlightColor)
		{
			ctx.fillStyle = highlightColor.styleString();
			ctx.fillRect(
				noteRect.x, noteRect.y,
				noteRect.w, noteRect.h);
		};

		var drawNotes = function(notes)
		{
			var pointingHighlightColor = makeColor(200, 255, 0, 0.3);
			var creatingHighlightColor = makeColor(200, 255, 0, 0.6);

			var pointingAtNote = false;

			for (var i = 0; i < notes.length; i++)
			{
				var noteRect = rectFromNote(notes[i]);

				drawNoteRect(noteRect);

				if (noteRect.contains(pointerLocation))
				{
					drawNoteHighlight(noteRect, pointingHighlightColor);
					pointingAtNote = true;
				}
				else if (cellFromCanvasPosition(noteRect.x, noteRect.y)
						.equals(highlightedCell))
					pointingAtNote = true;
			}

			drawNoteRect(noteRectPending);
			drawNoteHighlight(noteRectPending, creatingHighlightColor);
			if (noteRectPending.contains(pointerLocation) ||
				cellFromCanvasPosition(noteRectPending.x, noteRectPending.y)
					.equals(highlightedCell))
				pointingAtNote = true;

			if (pointingAtNote)
				ctx.strokeStyle = makeColor(255, 255, 255).styleString();
			else ctx.strokeStyle = makeColor(0, 0, 0).styleString();
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
				if (noteRect.contains(position))
					return { found: true, value: previousNotes[i] };
			}
			return { found: false, value: undefined };
		};

		// If draw is called without notes,
		// it will use the notes from last time
		var previousNotes;
		var draw = function(notes)
		{
			ctx.fillStyle = makeColor(255, 255, 255).styleString();
			ctx.fillRect(0, 0, canvasWidth, canvasHeight);

			drawGrid();

			if (previousNotes === undefined)
				previousNotes = [];

			if (notes !== undefined)
			{
				drawNotes(notes);
				previousNotes = notes;
			}
			else drawNotes(previousNotes);
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
			event.preventDefault();
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
				onNoteRectRightClicked[i](note.value);

			draw();

			return false;
		});

		window.addEventListener("mousemove", function(event)
		{
			var mouse = mousePositionFromCanvasEvent(event);
			highlightedCell = cellFromCanvasPosition(mouse.x, mouse.y);
			pointerLocation = makeVector(mouse.x, mouse.y);

			if (drawingNote)
			{
				var startCell = cellFromCanvasPosition(
					noteRectPending.x, noteRectPending.y);
				var distanceX = highlightedCell.x - startCell.x + 1;
				if (distanceX < 1)
					distanceX = 1;
				noteRectPending = makeRect(
					noteRectPending.x, noteRectPending.y,
					distanceX * noteWidth, noteRectPending.h);
			}

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

		var overlappingNotes = function(note)
		{
			var overlapping = [];
			for (var i=0; i<notes.length; i++)
			{
				if (notes[i].pitch !== note.pitch)
					continue;
				var newNoteStart = note.startTimeInBeats;
				var newNoteEnd = newNoteStart + note.durationInBeats;
				var currentNoteStart = notes[i].startTimeInBeats;
				var currentNoteEnd = currentNoteStart + notes[i].durationInBeats;
				if (newNoteStart >= currentNoteStart && newNoteStart <= currentNoteEnd ||
					newNoteEnd >= currentNoteStart && newNoteEnd <= currentNoteEnd)
				{
					overlapping.push({
						note: notes[i],
						overlap: {start: newNoteStart, end: newNoteEnd}});
				}
			}
			return overlapping;
		};

		var addNote = function(pitch, startTimeInBeats, durationInBeats)
		{
			var note = {
				pitch: pitch,
				startTimeInBeats: startTimeInBeats,
				durationInBeats: durationInBeats};

			var overlapping= overlappingNotes(note);
			console.log(overlapping.length);
			var newNotes = [];
			for (var i=0; i<overlapping.length; i++)
			{
				var pieces = {};
				var oldNote = overlapping[i].note;
				var overlap = overlapping[i].overlap;
				var oldNoteStart = oldNote.startTimeInBeats;
				var oldNoteEnd = oldNote.startTimeInBeats + oldNote.durationInBeats;

				if (overlap.start > oldNoteStart)
					pieces.before =  {
						start: oldNoteStart,
						duration: overlap.start - oldNoteStart};
				if (overlap.end < oldNoteEnd)
					pieces.after = {
						start: overlap.end,
						duration: oldNoteEnd - overlap.end};

				if (pieces.before !== undefined)
					newNotes.push({pitch: pitch,
						startTimeInBeats: pieces.before.start,
						durationInBeats: pieces.before.duration});
				if (pieces.after !== undefined)
					newNotes.push({pitch: pitch,
						startTimeInBeats: pieces.after.start,
						durationInBeats: pieces.after.duration});

				removeNote(oldNote);
			}

			for (i=0; i<newNotes.length; i++)
				notes.push(newNotes[i]);
			notes.push(note);

			for (i=0; i<onNoteAdded.length; i++)
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
	};

})();