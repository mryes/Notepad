(function()
{
	"use strict";

	var gridShades = [200, 180, 230, 200];

	var makePad = function(id, width, height)
	{
		var canvas = document.getElementById(id);
		var ctx = canvas.getContext("2d");
		var canvasWidth = parseInt(canvas.getAttribute("width"));
		var canvasHeight = parseInt(canvas.getAttribute("height"));
		var noteWidth = canvasWidth / width;
		var noteHeight = canvasHeight / height;

		var colorStyle = function(r, g, b)
		{
			return "rgb(" + r + "," + g + "," + b + ")";
		};

		var colorStyleFromShade = function(shade)
		{
			return colorStyle(shade, shade, shade);
		}

		return {

			canvas: canvas,
			ctx: ctx,
			width: width, height: height,
			noteWidth: noteWidth, noteHeight: noteHeight,

			init: function()
			{
				this.draw();
			},

			draw: function()
			{
				for (var y=0; y<this.height; y+=2)
				{
					for (var x=0; x<this.width; x+=2)
					{
						var ctxPositionX = x * this.noteWidth;
						var ctxPositionY = y * this.noteHeight;
						ctx.fillStyle = colorStyleFromShade(gridShades[0]);
						ctx.fillRect(
							ctxPositionX, ctxPositionY,
							this.noteWidth, this.noteHeight);
						ctx.fillStyle = colorStyleFromShade(gridShades[1]);
						ctx.fillRect(
							ctxPositionX + this.noteWidth, ctxPositionY,
							this.noteWidth, this.noteHeight);
						ctx.fillStyle = colorStyleFromShade(gridShades[2]);
						ctx.fillRect(
							ctxPositionX, ctxPositionY + this.noteHeight,
							this.noteWidth, this.noteHeight);
						ctx.fillStyle = colorStyleFromShade(gridShades[3]);
						ctx.fillRect(
							ctxPositionX + this.noteWidth, ctxPositionY + this.noteHeight,
							this.noteWidth, this.noteHeight);
					}
				}
			}
		};
	}

	window.onload = function()
	{
		var pad = makePad("interface", 40, 30);
		pad.init();
	};

})();