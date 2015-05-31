(function()
{
	"use strict";

	var makePitch = notepad.makePitch;

	var makeNote = function(pitch, startTimeInBeats, durationInBeats)
	{
		var toString = function()
		{
			return pitch.toString() +
				startTimeInBeats + " " + durationInBeats;
		};

		var equals = function(note)
		{
			return pitch === note.pitch &&
				startTimeInBeats === note.startTimeInBeats &&
				durationInBeats === note.durationInBeats;
		};

		return Object.freeze({
			pitch: pitch,
			startTimeInBeats: startTimeInBeats,
			durationInBeats: durationInBeats,
			equals: equals,
			toString: toString });
	};

	var noteFromString = function(string)
	{
		var nums = string.split(" ");
		return makeNote(
			notepad.pitchFromString(string),
			parseFloat(nums[2]), parseFloat(nums[3]));
	};

	var makeVector = function(x, y)
	{
		var equals = function(other)
		{
			return this.x === other.x && this.y === other.y;
		};

		var add = function(other)
		{
			return makeVector(this.x + other.x, this.y + other.y);
		};

		var subtract = function(other)
		{
			return makeVector(this.x - other.x, this.y - other.y);
		};

		var scale = function(x, y)
		{
			return makeVector(this.x * x, this.y * y);
		};

		var toString = function()
		{
			return x + " " + y;
		};

		return Object.freeze({
			x:x, y:y,
			equals: equals,
			add: add, subtract: subtract,
			scale: scale,
			toString: toString });
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

		var intersects = function(rect)
		{
			var rectA = this;
			var rectB = rect;
			if (rectA.x2 === undefined)
				rectA = rectA.twoPoints();
			if (rectB.x2 === undefined)
				rectB = rectB.twoPoints();

			if (rectA.x1 < rectB.x2 && rectA.x2 > rectB.x1 &&
				rectA.y1 < rectB.y2 && rectA.y2 > rectB.y1)
			{
				return true;
			}

			return false;
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

		var twoPoints = function()
		{
			return {
				x1:x, y1:y,
				x2:x+w, y2:y+h };
		};

		var translate = function(x, y)
		{
			return makeRect(
				this.x + x, this.y + y,
				this.w, this.h);
		};

		return {
			x:x, y:y, w:w, h:h,
			contains: contains,
			intersects: intersects,
			unreverse: unreverse,
			twoPoints: twoPoints,
			translate: translate,
			get position()
			{
				return makeVector(this.x, this.y);
			}};
	};

	var rectFromTwoPoints = function(x1, y1, x2, y2)
	{
		return makeRect(
			x1, y1,
			x2-x1, y2-y1 );
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
		return makeNote(
			notepad.noteFromFullValue(fullValue),
			startTime, duration);
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

	var makeEnum = function(ids)
	{
		if (ids.constructor !== Array)
			throw new TypeError("Expected array");

		var obj = {};
		for (var i=0; i<ids.length; i++)
			obj[ids[i]] = i;
		return obj;
	};

	var cellFromCanvasPosition = function(x, y, grid)
	{
		return makeVector(
			Math.floor(x / grid.noteWidth),
			Math.floor(y / grid.noteHeight));
	};

	var toNearestCellOrigin = function(position, grid)
	{
		return cellFromCanvasPosition(position.x, position.y, grid)
			.scale(grid.noteWidth, grid.noteHeight);
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

	var tonicYPoints = function(tonic, grid)
	{
		var points = [];

		var octave = 0;
		var getFullValue = function(tonic, octave)
		{
			return makePitch(tonic, octave).fullValue();
		};
		var fullValue = getFullValue(tonic, octave);
		while (makePitch(tonic, octave).fullValue()  <
			grid.lastVisibleRow + grid.gridRows)
		{
			points.push(grid.height - grid.noteHeight -
				fullValue * grid.noteHeight);
			octave += 1;
			fullValue = getFullValue(tonic, octave);
		}

		return points;
	};

	var triggerEvent = function(event)
	{
		var args = [];
		for (var i=1; arguments[i] !== undefined; i++)
			args.push(arguments[i]);
		for (i=0; i<event.length; i++)
			event[i].apply(this, args);
	};

	var modes = makeEnum(["normal", "select"]);
	var defaultMode = modes.normal;

	var makeNoteGrid = function(id, grid, pad)
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

		var pointerPosition = makeVector(-1, -1);
		var highlightedCell = makeVector(-1, -1); // todo: make this a function
		var mouseWithinBounds = false; // this too?

		var noteRectActions = makeEnum(["none", "creating", "moving"]);
		var currentNoteRectAction = noteRectActions.none;
		var noteRectPending = makeRect(-1, -1, -1, -1);
		var noteRectPendingStart = noteRectPending;
		var noteRectPendingGrabOffset = makeVector(-1, -1, -1);

		var tonicPoints = [];

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

			var tonicR = 110;
			var tonicG = 175;
			var tonicB = 0;
			ctx.fillStyle = makeColor(tonicR, tonicG, tonicB, 0.2).styleString();
			ctx.strokeStyle = makeColor(tonicR, tonicG, tonicB, 0.6).styleString();
			for (var i=0; i<tonicPoints.length; i++)
			{
				ctx.fillRect(
					0, tonicPoints[i],
					canvasWidth, noteHeight);
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(0, tonicPoints[i] + ctx.lineWidth/2);
				ctx.lineTo(canvasWidth, tonicPoints[i] + ctx.lineWidth/2);
				ctx.moveTo(0, tonicPoints[i] - ctx.lineWidth/2 + noteHeight);
				ctx.lineTo(canvasWidth, tonicPoints[i] - ctx.lineWidth/2 + noteHeight);
				ctx.stroke();
			}

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

				if (noteRect.contains(pointerPosition))
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
			if (pendingNoteUnreversed.contains(pointerPosition) ||
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

		var beginCreatingNote = function()
		{
			currentNoteRectAction = noteRectActions.creating;
			noteRectPending = makeRect(
				highlightedCell.x * noteWidth,
				highlightedCell.y * noteHeight,
				noteWidth, noteHeight);
			noteRectPendingStart = noteRectPending;
		};

		var beginMovingNote = function(note)
		{
			currentNoteRectAction = noteRectActions.moving;
			pad.removeNote(note);
			noteRectPending = rectFromNote(note, grid);
			noteRectPendingGrabOffset =
				pointerPosition.x - noteRectPending.position.x;
		};

		canvas.addEventListener("mousedown", function(event)
		{
			if (event.button !== 0) return;
			event.preventDefault();

			var noteHere = noteAtPosition(pointerPosition);
			if (noteHere.found)
			{
				beginMovingNote(noteHere.value);
			}
			else beginCreatingNote();

			draw();
		});

		window.addEventListener("mouseup", function(event)
		{
			if (event.button !== 0) return;
			if (currentNoteRectAction === noteRectActions.creating)
			{
				currentNoteRectAction = noteRectActions.none;
				var newX = (noteRectPending.x < 0) ? 0 : noteRectPending.x;
				var newW = noteRectPending.w;
				if (noteRectPending.x < 0)
					newW += noteRectPending.x;
				noteRectPending = makeRect(
					newX, noteRectPending.y,
					newW, noteRectPending.h);
				pad.addNote(noteFromRect(noteRectPending, grid));
				noteRectPending = makeRect(-1, -1, -1, -1);
				draw();
			}
			else if (currentNoteRectAction === noteRectActions.moving)
			{
				currentNoteRectAction = noteRectActions.none;
				pad.addNote(noteFromRect(noteRectPending, grid));
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

			pad.removeNote(note.value);

			draw();

			return false;
		});

		window.addEventListener("mousemove", function(event)
		{
			var mouse = mousePositionFromCanvasEvent(event, canvas, borderWidth);
			highlightedCell = cellFromCanvasPosition(mouse.x, mouse.y, grid);
			pointerPosition = makeVector(mouse.x, mouse.y);

			if (currentNoteRectAction === noteRectActions.creating)
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
			else if (currentNoteRectAction === noteRectActions.moving)
			{
				var gridPointer = toNearestCellOrigin(pointerPosition, grid)
				var newPos = toNearestCellOrigin(
					gridPointer	.subtract(makeVector(noteRectPendingGrabOffset, 0))
						.add(makeVector(noteWidth, 0)),
					grid);
				noteRectPending = makeRect(
					newPos.x, newPos.y,
					noteRectPending.w, noteRectPending.h);
				draw();
			}
			else if (mouse.x >= 0 || mouse.y >= 0 ||
				mouse.x < canvasWidth || mouse.y < canvasHeight)
			{
				draw();
			}
		});

		canvas.addEventListener("mouseenter", function()
		{
			mouseWithinBounds = true;
		});

		canvas.addEventListener("mouseleave", function()
		{
			highlightedCell = makeVector(-1, -1);
			pointerPosition = makeVector(-1, -1);
			mouseWithinBounds = false;
			draw();
		});

		var shiftKey = 16;

		document.addEventListener("keydown", function(event)
		{
			if (!mouseWithinBounds) return;
			event.preventDefault();
			if (event.keyCode === shiftKey)
			{
				pad.mode = modes.select;
			}
		});

		document.addEventListener("keyup", function(event)
		{
			event.preventDefault();
			if (event.keyCode === shiftKey)
			{
				if (pad.mode === modes.select)
					pad.mode = modes.normal;
			}
		});

		var onNoteAdded = function(note, allNotes)
		{
			draw(allNotes);
		};

		var onSelectionChanged = function(selection)
		{
		};

		var onTonicChanged = function(tonic)
		{
			tonicPoints = tonicYPoints(tonic, grid);
			draw();
		};

		return {
			draw: draw,
			onNoteAdded: onNoteAdded,
			onSelectionChanged: onSelectionChanged,
			onTonicChanged: onTonicChanged };
	};

	var makeTonicGrid = function(id, grid, pad)
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
			var point = makeVector(0, ypos);

			ctx.fillStyle = makeColor(200, 255, 120).styleString();

			// This is unfortunate
			// (it's a house)
			var roofHeight = noteHeight/2;
			var bottomHeight = noteHeight - roofHeight;
			ctx.beginPath();
			ctx.moveTo(0, point.y + 1 + roofHeight);
			ctx.lineTo(noteWidth/2, point.y);
			ctx.lineTo(noteWidth, point.y + 1 + roofHeight);
			ctx.fill();
			ctx.fillRect(
				point.x + noteWidth/6, point.y + roofHeight,
				noteWidth*(2/3), bottomHeight);
			ctx.fillStyle = makeColor(110, 160, 0).styleString();
			ctx.fillRect(
				point.x + noteWidth*(3/8), point.y + roofHeight + bottomHeight/2,
				noteWidth/4, bottomHeight/2);
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
			//triggerEvent(onTonicRectClicked, pitch.value);
			pad.tonic = pitch.value;
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

		var onTonicChanged = function(tonic)
		{
			tonicPoints = tonicYPoints(tonic, grid);
			draw();
		};

		return {
			draw: draw,
			onTonicChanged: onTonicChanged };
	};

	var startPadView = function(id, pad)
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

		var noteGrid = makeNoteGrid(id, gridMeasurements, pad);
		var tonicGrid = makeTonicGrid(id, gridMeasurements, pad);

		pad.onNoteAdded.push(noteGrid.onNoteAdded);
		pad.onSelectionChanged.push(noteGrid.onSelectionChanged);
		pad.onTonicChanged.push(tonicGrid.onTonicChanged);
		pad.onTonicChanged.push(noteGrid.onTonicChanged);

		noteGrid.draw();
		tonicGrid.draw();

		return { };
	};

	var makePad = function()
	{
		var notes = [];
		var selection = [];
		var tonicPitch = makePitch(0, 4);

		var currentMode = defaultMode;

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

		var addNote = function(note)
		{
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
					newNotes.push(makeNote(
						note.pitch,
						pieces.before.start,
						pieces.before.duration));
				if (pieces.after !== undefined)
					newNotes.push(makeNote(
						note.pitch,
						pieces.after.start,
						pieces.after.duration));

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
				addNote(notes[i]);
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

		var createSelectionBetween = function(noteA, noteB)
		{
			var pitchA = noteA.pitch.fullValue();
			var startA = noteA.startTimeInBeats;
			var pitchB = noteB.pitch.fullValue();
			var startB = noteB.startTimeInBeats;

			// Include start and end;
			// How you do this depends on which note is greater
			if (pitchA > pitchB) pitchA++; else pitchB++;
			if (startA > startB) startA++; else startB++;

			selection = {};

			for (var i=0; i<notes.length; i++)
			{
				var pitch = notes[i].pitch.fullValue();
				var start = notes[i].startTimeInBeats;
				var dur = notes[i].durationInBeats;

				if (rectFromTwoPoints(pitchA, startA, pitchB, startB).unreverse()
					.intersects(makeRect(pitch, start, dur, 1)))
				{
					selection[notes[i]] = true;
				}
			}

			triggerEvent(onSelectionChanged, selection);
		};

		var setTonic = function(newTonic)
		{
			tonicPitch = newTonic;
			triggerEvent(onTonicChanged, tonicPitch);
		};

		// parameters: (note, allNotes)
		var onNoteAdded = [];

		// parameters: (tonic)
		var onTonicChanged = [];

		// parameters: (selection)
		var onSelectionChanged = [];

		return Object.freeze(
		{
			addNote: addNote, addNotes: addNotes,
			removeNote: removeNote,
			get mode() { return mode; },
			set mode(newMode) { currentMode = newMode; },
			get tonic() { return tonicPitch; },
			set tonic(newTonic) { setTonic(newTonic); },
			onNoteAdded: onNoteAdded,
			onTonicChanged: onTonicChanged,
			onSelectionChanged: onSelectionChanged,
		});
	};

	window.onload = function()
	{
		var pad = makePad();
		startPadView("notepad", pad);
		pad.tonic = 0;
	};

})();