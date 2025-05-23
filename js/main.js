const REV = 10;
const BRUSHES = ["sketchy", "shaded", "chrome", "fur", "longfur", "web", "", "simple", "squares", "ribbon", "", "circles", "grid"];
const USER_AGENT = navigator.userAgent.toLowerCase();

var SCREEN_WIDTH = window.innerWidth,
    SCREEN_HEIGHT = window.innerHeight,
    PIXEL_RATIO = Math.max( 1, window.devicePixelRatio ),
    BRUSH_SIZE = 1,
    BRUSH_PRESSURE = 1,
    COLOR = [0, 0, 0],
    BACKGROUND_COLOR = [250, 250, 250],
    STORAGE = window.localStorage,
    MAX_UNDO_STEPS = 20,  // Maximum number of undo steps
    undoHistory = [],     // Array to store canvas states for undo
    redoHistory = [],     // Array to store canvas states for redo
    isStrokeInProgress = false, // Flag to track if a stroke is being drawn
    brush,
    saveTimeOut,
    wacom,
    i,
    mouseX = 0,
    mouseY = 0,
    container,
    foregroundColorSelector,
    backgroundColorSelector,
    menu,
    about,
    canvas,
    flattenCanvas,
    context,
    isFgColorSelectorVisible = false,
    isBgColorSelectorVisible = false,
    isAboutVisible = false,
    isMenuMouseOver = false,
    shiftKeyIsDown = false,
    altKeyIsDown = false;

init();

function init()
{
	var hash, palette, embed, localStorageImage;

	if (USER_AGENT.search("android") > -1 || USER_AGENT.search("iphone") > -1)
		BRUSH_SIZE = 2;

	if (USER_AGENT.search("safari") > -1 && USER_AGENT.search("chrome") == -1) // Safari
		STORAGE = false;

	document.body.style.backgroundRepeat = 'no-repeat';
	document.body.style.backgroundPosition = 'center center';

	container = document.createElement('div');
	document.body.appendChild(container);

	/*
	 * TODO: In some browsers a naste "Plugin Missing" window appears and people is getting confused.
	 * Disabling it until a better way to handle it appears.
	 *
	 * embed = document.createElement('embed');
	 * embed.id = 'wacom-plugin';
	 * embed.type = 'application/x-wacom-tablet';
	 * document.body.appendChild(embed);
	 *
	 * wacom = document.embeds["wacom-plugin"];
	 */

	canvas = document.createElement("canvas");
	canvas.width = SCREEN_WIDTH * PIXEL_RATIO;
	canvas.height = SCREEN_HEIGHT * PIXEL_RATIO;
	canvas.style.cursor = 'crosshair';
	canvas.style.width = SCREEN_WIDTH + 'px';
	canvas.style.height = SCREEN_HEIGHT + 'px';
	container.appendChild(canvas);

	context = canvas.getContext("2d");
	context.save();
	context.scale(PIXEL_RATIO, PIXEL_RATIO);

	flattenCanvas = document.createElement("canvas");
	flattenCanvas.width = SCREEN_WIDTH * PIXEL_RATIO;
	flattenCanvas.height = SCREEN_HEIGHT * PIXEL_RATIO;

	palette = new Palette();

	foregroundColorSelector = new ColorSelector(palette);
	foregroundColorSelector.addEventListener('change', onForegroundColorSelectorChange, false);
	container.appendChild(foregroundColorSelector.container);

	backgroundColorSelector = new ColorSelector(palette);
	backgroundColorSelector.addEventListener('change', onBackgroundColorSelectorChange, false);
	container.appendChild(backgroundColorSelector.container);

	menu = new Menu();
	menu.foregroundColor.addEventListener('click', onMenuForegroundColor, false);
	menu.foregroundColor.addEventListener('touchend', onMenuForegroundColor, { passive: false });
	menu.backgroundColor.addEventListener('click', onMenuBackgroundColor, false);
	menu.backgroundColor.addEventListener('touchend', onMenuBackgroundColor, false);
	menu.selector.addEventListener('change', onMenuSelectorChange, false);
	menu.save.addEventListener('click', onMenuSave, false);
	menu.save.addEventListener('touchend', onMenuSave, false);
	menu.clear.addEventListener('click', onMenuClear, false);
	menu.clear.addEventListener('touchend', onMenuClear, false);
	menu.about.addEventListener('click', onMenuAbout, false);
	menu.about.addEventListener('touchend', onMenuAbout, false);
	menu.undo.addEventListener('click', onMenuUndo, false);
	menu.undo.addEventListener('touchend', onMenuUndo, false);
	menu.redo.addEventListener('click', onMenuRedo, false);
	menu.redo.addEventListener('touchend', onMenuRedo, false);
	menu.container.addEventListener('mouseover', onMenuMouseOver, { passive: false });
	menu.container.addEventListener('mouseout', onMenuMouseOut, { passive: false });
	container.appendChild(menu.container);

	if (STORAGE)
	{
		if (localStorage['harmony-canvas'])
		{
			localStorageImage = new Image();

			localStorageImage.addEventListener("load", function(event)
			{
				localStorageImage.removeEventListener(event.type, arguments.callee, false);
				context.restore();
				context.drawImage(localStorageImage,0,0);
				context.scale(PIXEL_RATIO, PIXEL_RATIO);
			}, false);

			localStorageImage.src = localStorage['harmony-canvas'];
		}

		if (localStorage['harmony-bg'])
		{
			let array = JSON.parse(localStorage['harmony-color']);

			COLOR[0] = array[0];
			COLOR[1] = array[1];
			COLOR[2] = array[2];
		}

		if (localStorage['harmony-bg'])
		{
			let array = JSON.parse(localStorage['harmony-bg']);

			BACKGROUND_COLOR[0] = array[0];
			BACKGROUND_COLOR[1] = array[1];
			BACKGROUND_COLOR[2] = array[2];
		}
	}

	foregroundColorSelector.setColor( COLOR );
	backgroundColorSelector.setColor( BACKGROUND_COLOR );

	if (window.location.hash)
	{
		hash = window.location.hash.substr(1,window.location.hash.length);

		for (i = 0; i < BRUSHES.length; i++)
		{
			if (hash == BRUSHES[i])
			{
				brush = eval("new " + BRUSHES[i] + "(context)");
				menu.selector.selectedIndex = i;
				break;
			}
		}
	}

	if (!brush)
	{
		brush = eval("new " + BRUSHES[0] + "(context)");
	}

	about = new About();
	container.appendChild(about.container);

	window.addEventListener('mousemove', onWindowMouseMove, false);
	window.addEventListener('resize', onWindowResize, false);
	window.addEventListener('keydown', onWindowKeyDown, false);
	window.addEventListener('keyup', onWindowKeyUp, false);
	window.addEventListener('blur', onWindowBlur, false);

	document.addEventListener('mousedown', onDocumentMouseDown, false);
	document.addEventListener('mouseout', onDocumentMouseOut, false);

	document.addEventListener("dragenter", onDocumentDragEnter, false);
	document.addEventListener("dragover", onDocumentDragOver, false);
	document.addEventListener("drop", onDocumentDrop, false);

	canvas.addEventListener('mousedown', onCanvasMouseDown, { passive: false });
	canvas.addEventListener('touchstart', onCanvasTouchStart, { passive: false });

	onWindowResize(null);
}


// WINDOW

function onWindowMouseMove( event )
{
	mouseX = event.clientX;
	mouseY = event.clientY;
}

function onWindowResize()
{
	SCREEN_WIDTH = window.innerWidth;
	SCREEN_HEIGHT = window.innerHeight;

	menu.container.style.left = ((SCREEN_WIDTH - menu.container.offsetWidth) / 2) + 'px';

	about.container.style.left = ((SCREEN_WIDTH - about.container.offsetWidth) / 2) + 'px';
	about.container.style.top = ((SCREEN_HEIGHT - about.container.offsetHeight) / 2) + 'px';
}

function onWindowKeyDown( event )
{
	if (shiftKeyIsDown)
		return;

	switch(event.keyCode)
	{
		case 16: // Shift
			shiftKeyIsDown = true;
			foregroundColorSelector.container.style.left = mouseX - 125 + 'px';
			foregroundColorSelector.container.style.top = mouseY - 125 + 'px';
			foregroundColorSelector.container.style.visibility = 'visible';
			break;

		case 18: // Alt
			altKeyIsDown = true;
			break;

		case 68: // d
			if(BRUSH_SIZE > 1) BRUSH_SIZE --;
			break;

		case 70: // f
			BRUSH_SIZE ++;
			break;
	}
}

function onWindowKeyUp( event )
{
	switch(event.keyCode)
	{
		case 16: // Shift
			shiftKeyIsDown = false;
			foregroundColorSelector.container.style.visibility = 'hidden';
			break;

		case 18: // Alt
			altKeyIsDown = false;
			break;

		case 82: // r
			brush.destroy();
			brush = eval("new " + BRUSHES[menu.selector.selectedIndex] + "(context)");
			break;
		case 66: // b
			document.body.style.backgroundImage = null;
			break;
	}

	context.lineCap = BRUSH_SIZE == 1 ? 'butt' : 'round';
}

function onWindowBlur( event )
{
	shiftKeyIsDown = false;
	altKeyIsDown = false;
}


// DOCUMENT

function onDocumentMouseDown( event )
{
	if (!isMenuMouseOver)
		event.preventDefault();
}

function onDocumentMouseOut( event )
{
	onCanvasMouseUp();
}

function onDocumentDragEnter( event )
{
	event.stopPropagation();
	event.preventDefault();
}

function onDocumentDragOver( event )
{
	event.stopPropagation();
	event.preventDefault();
}

function onDocumentDrop( event )
{
	event.stopPropagation();
	event.preventDefault();

	var file = event.dataTransfer.files[0];

	if (file.type.match(/image.*/))
	{
		/*
		 * TODO: This seems to work on Chromium. But not on Firefox.
		 * Better wait for proper FileAPI?
		 */

		var fileString = event.dataTransfer.getData('text').split("\n");
		document.body.style.backgroundImage = 'url(' + fileString[0] + ')';
	}
}


// COLOR SELECTORS

function onForegroundColorSelectorChange( event )
{
	COLOR = foregroundColorSelector.getColor();

	menu.setForegroundColor( COLOR );

	if (STORAGE)
	{
		localStorage['harmony-color'] = JSON.stringify(COLOR);
	}
}

function onBackgroundColorSelectorChange( event )
{
	BACKGROUND_COLOR = backgroundColorSelector.getColor();

	menu.setBackgroundColor( BACKGROUND_COLOR );

	document.body.style.backgroundColor = 'rgb(' + BACKGROUND_COLOR[0] + ', ' + BACKGROUND_COLOR[1] + ', ' + BACKGROUND_COLOR[2] + ')';

	if (STORAGE)
	{
		localStorage['harmony-bg'] = JSON.stringify(BACKGROUND_COLOR);
	}
}


// MENU

function onMenuForegroundColor()
{
	cleanPopUps();

	foregroundColorSelector.show();
	foregroundColorSelector.container.style.left = ((SCREEN_WIDTH - foregroundColorSelector.container.offsetWidth) / 2) + 'px';
	foregroundColorSelector.container.style.top = ((SCREEN_HEIGHT - foregroundColorSelector.container.offsetHeight) / 2) + 'px';

	isFgColorSelectorVisible = true;
}

function onMenuBackgroundColor()
{
	cleanPopUps();

	backgroundColorSelector.show();
	backgroundColorSelector.container.style.left = ((SCREEN_WIDTH - backgroundColorSelector.container.offsetWidth) / 2) + 'px';
	backgroundColorSelector.container.style.top = ((SCREEN_HEIGHT - backgroundColorSelector.container.offsetHeight) / 2) + 'px';

	isBgColorSelectorVisible = true;
}

function onMenuSelectorChange()
{
	if (BRUSHES[menu.selector.selectedIndex] == "")
		return;

	brush.destroy();
	brush = eval("new " + BRUSHES[menu.selector.selectedIndex] + "(context)");

	window.location.hash = BRUSHES[menu.selector.selectedIndex];
}

function onMenuMouseOver()
{
	isMenuMouseOver = true;
}

function onMenuMouseOut()
{
	isMenuMouseOver = false;
}

function onMenuSave()
{
	// window.open(canvas.toDataURL('image/png'),'mywindow');
	flatten();
	window.open(flattenCanvas.toDataURL('image/png'),'mywindow');
}

function onMenuClear()
{
	if (!confirm("Are you sure?"))
		return;

	// Save the current state before clearing
	saveCanvasState();

	context.clearRect(0, 0, SCREEN_WIDTH * PIXEL_RATIO, SCREEN_HEIGHT * PIXEL_RATIO);

	saveToLocalStorage();

	brush.destroy();
	brush = eval("new " + BRUSHES[menu.selector.selectedIndex] + "(context)");
}

function onMenuAbout()
{
	cleanPopUps();

	isAboutVisible = true;
	about.show();
}

function onMenuUndo() {
    undo();
    saveToLocalStorage();
}

function onMenuRedo() {
    redo();
    saveToLocalStorage();
}


// CANVAS

function onCanvasMouseDown( event )
{
	var data, position;

	clearTimeout(saveTimeOut);
	cleanPopUps();

	if (altKeyIsDown)
	{
		flatten();

		data = flattenCanvas.getContext("2d").getImageData(0, 0, flattenCanvas.width, flattenCanvas.height).data;
		position = (event.clientX + (event.clientY * canvas.width)) * 4;

		foregroundColorSelector.setColor( [ data[position], data[position + 1], data[position + 2] ] );

		return;
	}

	// Save canvas state before starting a new brush stroke
	if (!isStrokeInProgress) {
		saveCanvasState();
		isStrokeInProgress = true;
	}

	BRUSH_PRESSURE = wacom && wacom.isWacom ? wacom.pressure : 1;

	brush.strokeStart( event.clientX, event.clientY );

	window.addEventListener('mousemove', onCanvasMouseMove, { passive: false });
	window.addEventListener('mouseup', onCanvasMouseUp, { passive: false });
}

function onCanvasMouseMove( event )
{
	BRUSH_PRESSURE = wacom && wacom.isWacom ? wacom.pressure : 1;

	brush.stroke( event.clientX, event.clientY );
}

function onCanvasMouseUp()
{
	brush.strokeEnd();
	
	// Stroke is complete
	isStrokeInProgress = false;

	window.removeEventListener('mousemove', onCanvasMouseMove, { passive: false });
	window.removeEventListener('mouseup', onCanvasMouseUp, { passive: false });

	if (STORAGE)
	{
		clearTimeout(saveTimeOut);
		saveTimeOut = setTimeout(saveToLocalStorage, 2000, true);
	}
}


//

function onCanvasTouchStart( event )
{
	cleanPopUps();

	if(event.touches.length == 1)
	{
		event.preventDefault();

		// Save canvas state before starting a new brush stroke
		if (!isStrokeInProgress) {
			saveCanvasState();
			isStrokeInProgress = true;
		}

		brush.strokeStart( event.touches[0].pageX, event.touches[0].pageY );

		window.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
		window.addEventListener('touchend', onCanvasTouchEnd, { passive: false });
	}
}

function onCanvasTouchMove( event )
{
	if(event.touches.length == 1)
	{
		event.preventDefault();
		brush.stroke( event.touches[0].pageX, event.touches[0].pageY );
	}
}

function onCanvasTouchEnd( event )
{
	if(event.touches.length == 0)
	{
		event.preventDefault();

		brush.strokeEnd();
		
		// Stroke is complete
		isStrokeInProgress = false;

		window.removeEventListener('touchmove', onCanvasTouchMove, { passive: false });
		window.removeEventListener('touchend', onCanvasTouchEnd, { passive: false });
	}
}

//

function saveToLocalStorage()
{
	localStorage['harmony-canvas'] = canvas.toDataURL('image/png');
}

function flatten()
{
	var context = flattenCanvas.getContext("2d");

	context.fillStyle = 'rgb(' + BACKGROUND_COLOR[0] + ', ' + BACKGROUND_COLOR[1] + ', ' + BACKGROUND_COLOR[2] + ')';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.drawImage(canvas, 0, 0);
}

function cleanPopUps()
{
	if (isFgColorSelectorVisible)
	{
		foregroundColorSelector.hide();
		isFgColorSelectorVisible = false;
	}

	if (isBgColorSelectorVisible)
	{
		backgroundColorSelector.hide();
		isBgColorSelectorVisible = false;
	}

	if (isAboutVisible)
	{
		about.hide();
		isAboutVisible = false;
	}
}

function saveCanvasState() {
    // Save current canvas state to the undo history
    if (undoHistory.length >= MAX_UNDO_STEPS) {
        // Remove the oldest state if we've reached the maximum
        undoHistory.shift();
    }
    
    let canvasState = canvas.toDataURL('image/png');
    undoHistory.push(canvasState);
    
    // Clear redo history when a new action is performed
    redoHistory = [];
}

function undo() {
    if (undoHistory.length <= 0) return;
    
    // Save current state to redo history before undoing
    let currentState = canvas.toDataURL('image/png');
    redoHistory.push(currentState);
    
    // Get the last state from undo history
    let lastState = undoHistory.pop();
    
    // Load the state onto the canvas
    loadCanvasState(lastState);
}

function redo() {
    if (redoHistory.length <= 0) return;
    
    // Save current state to undo history before redoing
    let currentState = canvas.toDataURL('image/png');
    undoHistory.push(currentState);
    
    // Get the last state from redo history
    let nextState = redoHistory.pop();
    
    // Load the state onto the canvas
    loadCanvasState(nextState);
}

function loadCanvasState(dataURL) {
    let img = new Image();
    img.onload = function() {
        context.save();
        context.scale(1/PIXEL_RATIO, 1/PIXEL_RATIO);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0);
        context.restore();
    };
    img.src = dataURL;
}
