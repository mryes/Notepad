if (typeof notepad === "undefined")
	var notepad = {};

notepad.notesInOctave = 12;

// en.wikipedia.org/wiki/List_of_chords
notepad.chords =
{
	major: [4, 7],
	majorSeventh: [4, 7, 11],
	majorSixth: [4, 7, 9],
	majorNinth: [4, 7, 9, 14],
	minor: [3, 7],
	minorSixth: [3, 7, 9],
	diminished: [3, 6],
	diminishedSeventh: [3, 6, 9],
	halfDiminishedSeventh: [3, 6, 10],
	augmented: [4, 8],
	augmentedSixth: [6, 8],
	suspended: [5, 7],
	dominantSeventh: [4, 7, 10],
	dream: [5, 6, 7],
	mu: [2, 4, 7]
};

// en.wikipedia.org/wiki/List_of_musical_scales_and_modes
notepad.scales =
{
	major: [2, 4, 5, 7, 9, 11],
	naturalMinor: [2, 3, 5, 7, 8, 10],
	harmonicMinor: [2, 3, 5, 7, 8, 11],
	pentatonic: [2, 4, 7, 9],
	chromatic: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

// All note instances are here, so they can be compared easily
// (not sure if javascript has an easier way to do this, but it works as-is, so...)
notepad.notes = {};

(function()
{
	"use strict";

	notepad.namedTuple = function(fields, initializer)
	{
		if (!Array.isArray(fields))
			throw new TypeError("Expected array.");

		return function(params)
		{
			var object = {};

			if (typeof arguments[0] === "object" && arguments.length < 2)
			{
				Object.keys(params).forEach(function(field)
				{
					if (fields.indexOf(field) < 0) return;
					object[field] = params[field];
				});
			}
			else
			{
				for (var i=0; i<arguments.length; i++)
				{
					if (fields[i] !== undefined)
						object[fields[i]] = arguments[i];
				}
			}

			if (initializer !== undefined)
			{
				var newObject = initializer(object);
				if (newObject) object = newObject;
			}

			return Object.freeze(object);
		};
	};

	notepad.valueFromLetter = function(letter)
	{
		var notesInOctave = notepad.notesInOctave;

		var validLetters = "CDEFGAB";
		var symbol = (letter.length > 1) ? letter[1] : undefined;
		letter = letter[0].toUpperCase();
		if (symbol)
			letter += symbol;
		var letterIndex = validLetters.indexOf(letter[0]);
		if (letterIndex < 0)
			throw new TypeError("Must be a letter between A and G");
		var halfSteps = [2, 2, 1, 2, 2, 2];
		var value = 0;
		for (var i=0; i<letterIndex; i++)
			value += halfSteps[i];
		if (symbol === "#")
			value++;
		if (symbol === "b")
			value--;
		return value % notesInOctave;
	};

	notepad.makeNote = notepad.namedTuple(["value", "octave"], function(obj)
	{
		var valueFromLetter = notepad.valueFromLetter;
		var notesInOctave = notepad.notesInOctave;

		if (typeof obj.value !== "number")
		{
			if (typeof obj.value === "string")
				obj.value = valueFromLetter(obj.value);
			else throw new TypeError("\"value\" is a number or a letter");
		}
		if (typeof obj.octave !== "number")
			throw new TypeError("\"octave\" is a number");
		if (obj.value < 0 || obj.value > 11)
			throw new RangeError("\"value\" is a number between 0 and 11");
		if (obj.octave < 0)
			throw new RangeError("\"octave\" is non-negative");

		obj.toString = function()
		{
			var string = "";
			for (var field in obj)
			{
				if (!obj.hasOwnProperty(field)) continue;
				if (typeof obj[field] === "function") continue;
				string += obj[field] + " ";
			}
			return string;
		};

		// If new, add to pool of note objects;
		// otherwise, grab the existing one
		var string = obj.toString();
		if (notepad.notes[string] !== undefined)
			return notepad.notes[string];
		else notepad.notes[string] = obj;

		obj.fullValue = function()
		{
			return this.value + this.octave * notesInOctave;
		};

		obj.transpose = function(interval)
		{
			var fullValue = this.fullValue();
			fullValue += interval;
			return notepad.noteFromFullValue(fullValue);
		};
	});

	notepad.noteFromFullValue = function(fullValue)
	{
		var notesInOctave = notepad.notesInOctave;
		if (fullValue <= 0)
			return makeNote(0, 0);
		var newValue = fullValue % notesInOctave;
		var newOctave = Math.floor(fullValue / notesInOctave);
		return makeNote(newValue, newOctave);
	};

	notepad.notesFromIntervals = function(intervals, baseNote)
	{
		var makeNote = notepad.makeNote;

		var notes = [];
		notes.push(makeNote(baseNote.value, baseNote.octave));
		intervals.forEach(function(interval)
		{
			notes.push(baseNote.transpose(interval));
		});
		return notes;
	};

	notepad.chordIsSubset = function(chord, chordBaseNote, notes)
	{
		var notesFromIntervals = notepad.notesFromIntervals;

		var chordNotes = notesFromIntervals(chord, chordBaseNote);
		// todo: find out why creating this within the loop is wrong
		var existsTest = function(note)
		{
			return note.value === this.value;
		};
		for (var note in chordNotes)
		{
			if (!chordNotes.hasOwnProperty(note)) continue;
			if (!notes.some(existsTest, chordNotes[note]))
				return false;
		}
		return true;
	};

	notepad.compatibleChords = function(scale, scaleBaseNote, chordBaseNote)
	{
		var chordIsSubset = notepad.chordIsSubset;
		var chords = notepad.chords;

		var scaleNotes = notepad.notesFromIntervals(scale, scaleBaseNote);
		var compatibleList = [];
		for (var chord in chords)
		{
			if (!chords.hasOwnProperty(chord)) continue;
			if (chordIsSubset(chords[chord], chordBaseNote, scaleNotes))
				compatibleList.push(chord);
		}
		return compatibleList;
	};

	var makeNote = notepad.makeNote;
	var scales = notepad.scales;

	console.log(notepad.compatibleChords(scales.major, makeNote(2, 5), makeNote(1, 5)));

})();
