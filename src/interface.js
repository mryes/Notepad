(function()
{
	"use strict";

	var makeNote = notepad.makeNote;

	var makeVector = function(x, y)
	{
		var equals = function(other)
		{
			return this.x === other.x && this.y === other.y;
		};

		return {
			x:x, y:y,
			equals: equals};
	};

	var makeRect = function(x, y, w, h)
	{
		var contains = function(point)
		{
			var rectX2 = this.x + this.w;
			var rectY2 = this.y + this.h;
			return point.x > this.x && point.x < rectX2 &&
				point.y > this.y && point.y < rectY2 ;
		};

		var unreverse = function()
		{
			var newSize = makeVector(
				Math.abs(this.w), Math.abs(this.h));
			var newX = this.x;
			var newY = this.y;
			if (this.w < 0)
				newX += this.w;
			if (this.h < 0)
				newY += this.h;
			return makeRect(newX, newY, newSize.x, newSize.y);
		};

		return {
			x:x, y:y, w:w, h:h,
			contains: contains,
			unreverse: unreverse};
	};

	var makeColor = function(r, g, b, a)
	{
		if (a === undefined)
			a = 1;

		var styleString = function()
		{
			var string = "(" + this.r + "," + this.g + "," + this.b;
			if (this.a !== 1)
			{
				string = "rgba" + string;
				string += "," + this.a;
			}
			else string = "rgb" + string;
			string += ")";
			return string;
		};

		return {
			r:r, g:g, b:b, a:a,
			styleString: styleString};
	};

	var colorStyleFromShade = function(shade)
	{
		return makeColor(shade, shade, shade).styleString();
	};

	var rectFromNote = function(note, grid)
	{
		var fullValue = note.pitch.fullValue();
		var duration = note.durationInBeats;
		var startTime = note.startTimeInBeats;
		if (fullValue < grid.lastVisibleRow ||
			fullValue > grid.lastVisibleRow + grid.gridColumns)
			return makeRect(0, 0, 0, 0);
		var bottomCell = grid.height - grid.noteHeight;
		var x = startTime*grid.noteWidth;
		var y = bottomCell -
			((fullValue - grid.lastVisibleRow) * grid.noteHeight);
		var w = duration * grid.noteWidth;
		var h = grid.noteHeight;
		return makeRect(x, y, w, h);
	};

	var noteFromRect = function(rect, grid)
	{
		var startTime = (rect.x) / grid.noteWidth;
		var bottomCell = grid.height - grid.noteHeight;
		var fullValue =
			(bottomCell +
			grid.lastVisibleRow*grid.noteHeight - rect.y) /
			grid.noteHeight;
		fullValue = Math.floor(fullValue);
		var duration = rect.w / grid.noteWidth;
		return {pitch: notepad.noteFromFullValue(fullValue),
			startTimeInBeats: startTime,
			durationInBeats: duration};
	};

	var cellFromCanvasPosition = function(x, y, grid)
	{
		return makeVector(
			Math.floor(x / grid.noteWidth),
			Math.floor(y / grid.noteHeight));
	};

	var mousePositionFromCanvasEvent = function(event, canvas, borderWidth)
	{
		var canvasRect = canvas.getBoundingClientRect();
		var mouseX =
			event.clientX - canvasRect.left - borderWidth*2;
		var mouseY =
			event.clientY - canvasRect.top - borderWidth*2;
		return makeVector(mouseX, mouseY);
	};

	var triggerEvent = function(event)
	{
		var args = [];
		for (var i=1; arguments[i] !== undefined; i++)
			args.push(arguments[i]);
		for (i=0; i<event.length; i++)
			event[i].apply(this, args);
	};

	var makeNoteGrid = function(id, grid)
	{
		var canvasWidth = grid.width;
		var canvasHeight = grid.height;
		var canvas = document.createElement("canvas");
		canvas.setAttribute("width", canvasWidth.toString());
		canvas.setAttribute("height", canvasHeight.toString());
		document.getElementById(id).appendChild(canvas);
		var ctx = canvas.getContext("2d");

		var borderWidth = 3;
		canvas.style.border = borderWidth + "px solid";
		canvas.style.borderRadius = "10px 0px 0px 10px";
		canvas.style.padding = borderWidth + "px";
		canvas.style.backgroundColor = "white";

		var gridColumns = grid.gridColumns;
		var gridRows = grid.gridRows;
		var noteWidth = grid.noteWidth;
		var noteHeight = grid.noteHeight;
		var lastVisibleRow = grid.lastVisibleRow;

		var pointerLocation = makeVector(-1, -1);
		var highlightedCell = makeVector(-1, -1);

		var noteRectPending = makeRect(-1, -1, -1, -1);
		var noteRectPendingStart = noteRectPending;
		var drawingNote = false;

		var noteAtPosition = function(position)
		{
			if (previousNotes === undefined)
				return { found: false, value: undefined };
			for (var i=0; i<previousNotes.length; i++)
			{
				var noteRect = rectFromNote(previousNotes[i], grid);
				if (noteRect.contains(position))
					return { found: true, value: previousNotes[i] };
			}
			return { found: false, value: undefined };
		};

		var predrawnGridCanvas = document.createElement("canvas");
		predrawnGridCanvas.width = canvas.width;
		predrawnGridCanvas.height = canvas.height;
		var predrawnGridContext = predrawnGridCanvas.getContext("2d");

		(function predrawGrid()
		{
			var pctx = predrawnGridContext;

			var gridShades = [242, 233, 255, 242];

			for (var y=0; y<gridRows; y+=2)
			{
				for (var x=0; x<gridColumns; x+=2)
				{
					var ctxPosition = makeVector(
						x * noteWidth,
						y * noteHeight);

					pctx.fillStyle = colorStyleFromShade(gridShades[0]);
					pctx.fillRect(
						ctxPosition.x, ctxPosition.y,
						noteWidth, noteHeight);
					pctx.fillStyle = colorStyleFromShade(gridShades[1]);
					pctx.fillRect(
						ctxPosition.x + noteWidth, ctxPosition.y,
						noteWidth, noteHeight);
					pctx.fillStyle = colorStyleFromShade(gridShades[2]);
					pctx.fillRect(
						ctxPosition.x, ctxPosition.y + noteHeight,
						noteWidth, noteHeight);
					pctx.fillStyle = colorStyleFromShade(gridShades[3]);
					pctx.fillRect(
						ctxPosition.x + noteWidth, ctxPosition.y + noteHeight,
						noteWidth, noteHeight);
				}
			}
		})();

		var drawGrid = function()
		{
			ctx.drawImage(predrawnGridCanvas, 0, 0);
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
				var noteRect = rectFromNote(notes[i], grid).unreverse();

				drawNoteRect(noteRect);

				if (noteRect.contains(pointerLocation))
				{
					drawNoteHighlight(noteRect, pointingHighlightColor);
					pointingAtNote = true;
				}
				else if (cellFromCanvasPosition(noteRect.x, noteRect.y, grid)
						.equals(highlightedCell))
					pointingAtNote = true;
			}

			var pendingNoteUnreversed = noteRectPending.unreverse();
			drawNoteRect(pendingNoteUnreversed);
			drawNoteHighlight(pendingNoteUnreversed, creatingHighlightColor);
			if (pendingNoteUnreversed.contains(pointerLocation) ||
				cellFromCanvasPosition(pendingNoteUnreversed.x, pendingNoteUnreversed.y, grid)
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

		// If draw is called without notes,
		// it will use the notes from last time
		var previousNotes;
		var draw = function(notes)
		{
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

		canvas.addEventListener("mousedown", function(event)
		{
			if (event.button !== 0)
				return true;
			var mouse = mousePositionFromCanvasEvent(event, canvas, borderWidth);
			event.preventDefault();
			drawingNote = true;
			noteRectPending = makeRect(
				highlightedCell.x * noteWidth,
				highlightedCell.y * noteHeight,
				noteWidth, noteHeight);
			noteRectPendingStart = noteRectPending;
			draw();
		});

		window.addEventListener("mouseup", function(event)
		{
			if (event.button !== 0)
				return true;
			if (drawingNote)
			{
				drawingNote = false;
				var newX = (noteRectPending.x < 0) ? 0 : noteRectPending.x;
				var newW = noteRectPending.w;
				if (noteRectPending.x < 0)
					newW += noteRectPending.x;
				noteRectPending = makeRect(
					newX, noteRectPending.y,
					newW, noteRectPending.h);
				triggerEvent(onNoteRectCreated, noteFromRect(noteRectPending, grid));
				noteRectPending = makeRect(-1, -1, -1, -1);
				draw();
			}
		});

		canvas.addEventListener("contextmenu", function(event)
		{
			event.preventDefault();

			var mouse = mousePositionFromCanvasEvent(event, canvas, borderWidth);

			var note = noteAtPosition(mouse);
			if (!note.found) return false;

			triggerEvent(onNoteRectRightClicked, note.value);

			draw();

			return false;
		});

		window.addEventListener("mousemove", function(event)
		{
			var mouse = mousePositionFromCanvasEvent(event, canvas, borderWidth);
			highlightedCell = cellFromCanvasPosition(mouse.x, mouse.y, grid);
			pointerLocation = makeVector(mouse.x, mouse.y);

			if (drawingNote)
			{
				var startCell = cellFromCanvasPosition(
					noteRectPendingStart.x, noteRectPendingStart.y, grid);
				var distanceX = (highlightedCell.x + 1) - startCell.x;

				var rightBoundary = (canvasWidth)/noteWidth - startCell.x;
				if (distanceX > rightBoundary)
					distanceX = rightBoundary;

				var newX;
				var newWidth = distanceX * noteWidth;

				if (distanceX < 1)
				{
					newX = ((startCell.x - 1) + distanceX) * noteWidth;
					newWidth = ((startCell.x + 1) * noteWidth) - newX;
				}
				else newX = noteRectPendingStart.x;

				noteRectPending = makeRect(
					newX, noteRectPending.y,
					newWidth, noteRectPending.h);

				draw();
			}
			else if (mouse.x >= 0 || mouse.y >= 0 ||
				mouse.x < canvasWidth || mouse.y < canvasHeight)
			{
				draw();
			}
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

		var onNoteAdded = function(note, allNotes)
		{
			draw(allNotes);
		};

		return {
			draw: draw,
			onNoteAdded: onNoteAdded,
			onNoteRectRightClicked: onNoteRectRightClicked,
			onNoteRectCreated: onNoteRectCreated};
	};

	var makeTonicGrid = function(id, grid)
	{
		var canvasWidth = grid.noteWidth;
		var canvasHeight = grid.height;
		var canvas = document.createElement("canvas");
		canvas.setAttribute("width", canvasWidth.toString());
		canvas.setAttribute("height", canvasHeight.toString());
		document.getElementById(id).appendChild(canvas);
		var ctx = canvas.getContext("2d");

		var borderWidth = 3;
		canvas.style.borderWidth =
			borderWidth + "px " + borderWidth + "px " +
			borderWidth + "px 0px";
		canvas.style.borderStyle = "solid";
		canvas.style.borderRadius = "0px 10px 10px 0px";
		canvas.style.padding = borderWidth + "px";
		canvas.style.backgroundColor = "gray";

		var gridRows = grid.gridRows;
		var noteWidth = grid.noteWidth;
		var noteHeight = grid.noteHeight;
		var lastVisibleRow = grid.lastVisibleRow;

		var predrawnGridCanvas = document.createElement("canvas");
		predrawnGridCanvas.width = canvas.width;
		predrawnGridCanvas.height = canvas.height;
		var predrawnGridContext = predrawnGridCanvas.getContext("2d");

		var tonicPoints = [];
		var highlightedCell = -1;

		(function predrawGrid()
		{
			var pctx = predrawnGridContext;

			var darkShade = colorStyleFromShade(69);
			var lightShade = colorStyleFromShade(83);

			for (var i=0; i<gridRows; i++)
			{
				var ypos = i * noteHeight;
				var shade = (i%2 === 0) ? darkShade : lightShade;
				pctx.fillStyle = shade;
				pctx.fillRect(0, ypos, canvasWidth, noteHeight);
			}

		})();

		var drawTonicRect = function(ypos)
		{
			var point = makeVector(0, canvasHeight-noteHeight-ypos);

			ctx.fillStyle = ctx.createLinearGradient(
				point.x, point.y,
				point.x, point.y + noteHeight);

			ctx.fillStyle.addColorStop(0, makeColor(250, 255, 250).styleString());
			ctx.fillStyle.addColorStop(0.5, makeColor(170, 225, 0).styleString());
			ctx.fillStyle.addColorStop(1, makeColor(170, 225, 0).styleString());
			ctx.fillRect(point.x, point.y, noteWidth, noteHeight);
		};

		var draw = function()
		{
			ctx.drawImage(predrawnGridCanvas, 0, 0);

			for (var i=0; i<tonicPoints.length; i++)
				drawTonicRect(tonicPoints[i]);

			ctx.fillStyle = makeColor(255, 255, 255, 0.5).styleString();
			ctx.fillRect(0, highlightedCell * noteHeight, noteWidth, noteHeight);
		};

		canvas.addEventListener("click", function(event)
		{
			var mouseY = mousePositionFromCanvasEvent(event, canvas, borderWidth).y;
			if (mouseY < borderWidth) return true;
			var cellY = cellFromCanvasPosition(0, mouseY, grid).y;
			var pitch = noteFromRect(
				makeRect(0, cellY * noteHeight, noteWidth, noteHeight), grid).pitch;
			triggerEvent(onTonicRectClicked, pitch.value);
		});

		canvas.addEventListener("mouseenter", function()
		{
			document.body.style.cursor = "pointer";
		});

		canvas.addEventListener("mouseleave", function()
		{
			document.body.style.cursor = "auto";
			highlightedCell = -1;
			draw();
		});

		canvas.addEventListener("mousemove", function(event)
		{
			var mouse = mousePositionFromCanvasEvent(event, canvas, borderWidth);
			highlightedCell = cellFromCanvasPosition(mouse.x, mouse.y, grid).y;
			draw();
		});

		// parameters: (tonicPitch)
		var onTonicRectClicked = [];

		var onTonicChanged = function(tonic)
		{
			tonicPoints = [];

			var octave = 0;
			var getFullValue = function(tonic, octave)
			{
				return makeNote(tonic, octave).fullValue();
			};
			var fullValue = getFullValue(tonic, octave);
			while (makeNote(tonic, octave).fullValue()  <
				lastVisibleRow + gridRows)
			{
				tonicPoints.push(fullValue * noteHeight);
				octave += 1;
				fullValue = getFullValue(tonic, octave);
			}

			draw();
		};

		return {
			draw: draw,
			onTonicRectClicked: onTonicRectClicked,
			onTonicChanged: onTonicChanged} ;
	};

	var makePadView = function(id)
	{
		var width = 600;
		var height = 400;
		var gridColumns = 30;
		var gridRows = 20;
		var gridMeasurements = {
			width: width, height: height,
			gridColumns: gridColumns, gridRows: gridRows,
			noteWidth: width / gridColumns, noteHeight: height / gridRows,
			lastVisibleRow: 0};

		var noteGrid = makeNoteGrid(id, gridMeasurements);
		var tonicGrid = makeTonicGrid(id, gridMeasurements);

		var addPadEvents = function(pad)
		{
			pad.onNoteAdded.push(noteGrid.onNoteAdded);
			pad.onTonicChanged.push(tonicGrid.onTonicChanged);
		};

		noteGrid.draw();
		tonicGrid.draw();

		return {
			onNoteRectRightClicked: noteGrid.onNoteRectRightClicked,
			onNoteRectCreated: noteGrid.onNoteRectCreated,
			onTonicRectClicked: tonicGrid.onTonicRectClicked,
			addPadEvents: addPadEvents };
	};

	var makePad = function()
	{
		var notes = [];
		var tonicPitch = makeNote(0, 4);

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
					newNoteEnd >= currentNoteStart && newNoteEnd <= currentNoteEnd ||
					newNoteStart <= currentNoteStart && newNoteEnd >= currentNoteEnd)
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

		var setTonic = function(newTonic)
		{
			tonicPitch = newTonic;
			triggerEvent(onTonicChanged, tonicPitch);
		};

		var addPadViewEvents = function(padView)
		{
			padView.onNoteRectRightClicked.push(removeNote);
			padView.onNoteRectCreated.push(function(note)
			{
				addNote(note.pitch, note.startTimeInBeats, note.durationInBeats);
			});
			padView.onTonicRectClicked.push(setTonic);
		};

		return Object.freeze(
		{
			addNote: addNote, addNotes: addNotes,
			addPadViewEvents: addPadViewEvents,
			onNoteAdded: onNoteAdded,
			onTonicChanged: onTonicChanged,
			get tonic() { return tonicPitch; },
			set tonic(newTonic) { setTonic(newTonic); }
		});
	};

	window.onload = function()
	{
		var pad = makePad();
		var padView = makePadView("notepad");
		padView.addPadEvents(pad);
		pad.addPadViewEvents(padView);
		pad.tonic = 0;
	};

})();