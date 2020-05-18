/**
 * 	SpectraMosaic: Right panel
 * 
 * 	Developed at University of Bergen, Department of Informatics, by Laura Garrison and Jakub Vašíček
 * 	https://vis.uib.no/publications/Garrison2019SM/
 *  
 * 	Code authorship: Jakub Vašíček
 */

const heatmap_limits = [5, -5];										// limits after which ratios won't be distinguished (will be the darkest color)
const color_schemes = [d3.interpolateRdBu, d3.interpolateBrBG]; 	// used color schemes (d3 interpolation functions), first for positive ratios, second for negative ratios
const PPM_scale_cutoff = 0.7;										// cutoff on the chemical shift scale after which the tiles will appear gray and won't expand

// recognized metabolites and their respective chemical shifts (ppm)
const chemical_sifts = [0.9, 1.3, 1.33, 1.47, 1.92, 2.02, 2.50, 2.1, 2.35, 2.14, 2.46, 2.42, 3.02, 3.21, 3.52, 3.35, 3.43, 3.55, 3.56];
const metabolites = ["ML", "ML", "Lac", "Ala", "Ac", "NAA", "NAA", "Glu", "Glu", "Gln", "Gln", "Suc", "Cr", "Cho", "Cho", "sl", "Tau", "ml", "Gly"];

var ids_to_highlight = [];											// ids of voxels to be highlighted -- stored in a global variable to connect with the left panel easily

let viewR = function(p) {
	
	p.setup = function() {
		// get the element size from gridster
		var w = parseInt($("#grid_viewR").attr("data-sizex")) * (($( ".gridster" ).width() - gridster_api.options.widget_margins[0]) / 35 - 1); 
		var h = parseInt($("#grid_viewR").attr("data-sizey")) * (($( ".gridster" ).height() - gridster_api.options.widget_margins[1]) / 17 - 1); 
		p.createCanvas(w, h);
		
		p.textAlign(p.CENTER, p.CENTER);
		p.rectMode(p.CORNERS);

		// set up properties of the view
		p.margin = {left: Math.round(h / 4), top: Math.round(h / 20), right: Math.round(h / 50), bottom: Math.round(h / 4) }; // position of the heatmap in the sketch
		p.tileCount = {x: 20, y: 20};
		p.axisLength = {x: p.width - p.margin.left - p.margin.right, y: p.height - p.margin.top - p.margin.bottom};
		p.minTickLabelDistance = 32;	// minimal distance at which two axis ticks can have a label
		p.maxPeakHeight = Math.min(p.margin.left, p.margin.bottom) * 0.6;	// size of the displayed spectra
				
		// initialize data arrays for both axes
		p.xData = [];
		p.yData = [];
		p.xyData_sorted = [];
		
		p.expanded_data = [];
		
		// set up equidistant axis ticks and a scaling factor of 1 to each tile
		p.resetView();
		
		p.activeTick = -1;
		p.activeAxis = -1;	// -1 = no active axis, 0 = X axis active, 1 = Y axis active
		p.activeButton = -1;
		p.activeDropZone = -1;
		
		// previous position of the mouse -- used for dragging axis ticks
		p.mousePrevX = 0;
		p.mousePrevY = 0;
		
		// GUI
		p.my_buttons = [{caption: "Reset view", position: {x: p.width * 0.85, y: p.height * 0.95}, size: {x: p.width * 0.15 - 2, y: p.height * 0.05 - 2}},
						{caption: "Clear data", position: {x: 0, y: p.height * 0.95}, size: {x: p.width * 0.15 - 2, y: p.height * 0.05 - 2}}];
	};
	
	p.draw = function() {
		p.updateScene();
		p.noLoop();
	};
	
	p.resized = function() {
		var w = parseInt($("#grid_viewR").attr("data-sizex")) * (($( ".gridster" ).width() - gridster_api.options.widget_margins[0]) / 35 - 1); 
		var h = parseInt($("#grid_viewR").attr("data-sizey")) * (($( ".gridster" ).height() - gridster_api.options.widget_margins[1]) / 17 - 1); 
		p.resizeCanvas(w, h);
		
		// set up properties of the view
		p.margin = {left: Math.round(h / 4), top: Math.round(h / 20), right: Math.round(h / 50), bottom: Math.round(h / 4) };
		p.axisLength = {x: p.width - p.margin.left - p.margin.right, y: p.height - p.margin.top - p.margin.bottom};
		p.tileSize = {x: p.axisLength.x / p.tileCount.x, y: p.axisLength.y / p.tileCount.y};
		
		p.my_buttons[0] = {caption: "Reset view", position: {x: p.width * 0.85, y: p.height * 0.95}, size: {x: p.width * 0.15 - 2, y: p.height * 0.05 - 2}};
		p.my_buttons[1] = {caption: "Clear data", position: {x: 0, y: p.height * 0.95}, size: {x: p.width * 0.15 - 2, y: p.height * 0.05 - 2}};
				
		p.refreshTileValues_X();
		p.refreshTileValues_Y();
			
		p.updateScene();
	}
	
	p.resetView = function() {
		p.absoluteTicksPos = {x: [], y: []};	// positions of ticks in axes in percent (between 0 and 1)		
		p.relativeTicksPos = {x: [], y: []};	// positions of ticks on axes in pixels (between 0 and p.axisLength)
		p.tileScales = {x: [], y: []};			// scaling coefficients for tiles
		
		p.tileExpanded = {x: -1, y: -1};		// index of the tiles corresponding to the expanded cell
		
		for(var i = 0; i < p.tileCount.x+1; i++) {
			var axisPos = p.map(i, 0, p.tileCount.x, 0, 1);
			p.relativeTicksPos.x.push(axisPos);
			p.tileScales.x.push(1);
		}
		for(var i = 0; i < p.tileCount.y+1; i++) {
			var axisPos = p.map(i, 0, p.tileCount.y, 0, 1);
			p.relativeTicksPos.y.push(axisPos);
			p.tileScales.y.push(1);
		}
		
		p.refreshTileValues_X();
		p.refreshTileValues_Y();
		p.countIntegrals();
		// p.countExpandedRatios();
	}
	
	p.updateScene = function() {
		p.background(255);
		
		var redraw_left = (ids_to_highlight.length > 0); // if there was something highlighted, update left view
		
		ids_to_highlight = []; 		// voxels to be highlighted on mousover on expanded details (remains empty otherwise)
		
		// draw the border of the window
		p.strokeWeight(1);
		p.stroke(0);
		p.noFill();
		p.rect(0, 0, p.width-2, p.height-2);
		
		if (p.xData.length == 0 && p.yData.length == 0) {
			p.fill(0);
			p.noStroke();
			p.textFont("Arial", 16);
			p.text("Data not ready", p.width/2, p.height/2);			
		} else if (p.xData.length == 0) {
			p.fill(0);
			p.noStroke();
			p.textFont("Arial", 16);
			p.text("Data not ready", p.width/2, p.height/2);	
			p.drawYAxis();
			p.drawYCurve();		
			p.updateDataTable();	
		} else if (p.yData.length == 0) {
			p.fill(0);
			p.noStroke();
			p.textFont("Arial", 16);
			p.text("Data not ready", p.width/2, p.height/2);	
			p.drawXAxis();
			p.drawXCurve();	
			p.updateDataTable();		
		} else {
			p.drawXAxis();
			p.drawYAxis();
			p.drawMatrix();
			p.drawXCurve();
			p.drawYCurve();
			p.updateDataTable();
			if (redraw_left) {
				p5_view_L.updateScene();
			}
		}
		
		p.drawButtons();
	}
	
	p.drawButtons = function() {
		
		p.rectMode(p.CORNER);
			
		p.my_buttons.forEach(function(button) {			
			p.fill(255);
			p.stroke(0);
			
			p.rect(button.position.x, button.position.y, button.size.x, button.size.y);
			
			p.fill(0);
			p.noStroke();
			p.textFont("Arial", 12);
			
			p.text(button.caption, button.position.x + button.size.x / 2, button.position.y + button.size.y / 2);
		});
		
		p.rectMode(p.CORNERS);
	}
	
	p.drawXAxis = function() {
		var x_axis_from = p.xData[0].scale_orig[0];
		var x_axis_to = p.xData[0].scale_orig[p.xData[0].scale_orig.length-1];

		// draw axis line
		p.fill(0);
		p.noStroke();	
		p.textFont("Arial", 12);
		p.stroke(0);
		p.line(p.margin.left, p.height - p.margin.bottom, p.width - p.margin.right, p.height - p.margin.bottom);
		
		// variable to indicate a label was drawn
		var tickHasLabel = [];
		p.absoluteTicksPos.x = [];
		
		// draw ticks on X axis
		
		// draw first tick
		p.line(p.margin.left, p.height - p.margin.bottom - 5, p.margin.left, p.height - p.margin.bottom + 5);
		p.text(x_axis_from.toFixed(2), p.margin.left, p.height - p.margin.bottom + 15);
		tickHasLabel.push(true);
		p.absoluteTicksPos.x.push(0);
		
		// draw the rest, apply scaling of tiles
		
		for(var i = 1; i < p.tileCount.x+1; i++) {
			var axisPos = p.absoluteTicksPos.x[i-1] + p.xData[0].tile_values[i-1].length;			// true position according to the scaling factor of the tile
			var scalePos = p.map(p.relativeTicksPos.x[i], 0, 1, x_axis_from, x_axis_to);			// position without scaling factor

			p.line(p.margin.left + axisPos, p.height - p.margin.bottom - 5, p.margin.left + axisPos, p.height - p.margin.bottom + 5);
			
			//	decide whether to draw a label, remember the decision
			if (p.abs(axisPos - p.absoluteTicksPos.x[i-1]) > p.minTickLabelDistance) {
				p.text(scalePos.toFixed(2), p.margin.left + axisPos, p.height - p.margin.bottom + 15);
				tickHasLabel.push(true);
			} else if (!tickHasLabel[i-1] && (i < 2 || !tickHasLabel[i-2] || p.abs(axisPos - p.absoluteTicksPos.x[i-2]) > p.minTickLabelDistance)) {
				p.text(scalePos.toFixed(2), p.margin.left + axisPos, p.height - p.margin.bottom + 15);
				tickHasLabel.push(true);					
			} else {
				tickHasLabel.push(false);										
			}
			
			//	remember scaled position on the axis and on PPM scale
			p.absoluteTicksPos.x.push(axisPos);
		}
	}
	
	p.drawYAxis = function() {
		var y_axis_from = p.yData[0].scale_orig[0];
		var y_axis_to = p.yData[0].scale_orig[p.yData[0].scale_orig.length-1];

		// draw axis line
		p.fill(0);
		p.noStroke();	
		p.textFont("Arial", 12);	
		p.stroke(0);
		p.line(p.margin.left, p.margin.top, p.margin.left, p.height - p.margin.bottom);

		// variable to indicate a label was drawn
		var tickHasLabel = [];
		p.absoluteTicksPos.y = [];
		
		// draw ticks on Y axis
		
		// draw first tick
		p.line(p.margin.left - 5, p.height - p.margin.bottom, p.margin.left + 5, p.height - p.margin.bottom);
		p.text(y_axis_from.toFixed(2), p.margin.left - 25, p.height - p.margin.bottom);
		tickHasLabel.push(true);
		p.absoluteTicksPos.y.push(0);
		
		// draw the rest, apply scaling of tiles
		
		for(var i = 1; i < p.tileCount.y+1; i++) {
			var axisPos = p.absoluteTicksPos.y[i-1] + p.yData[0].tile_values[i-1].length;		// true position according to the scaling factor of the tile
			var scalePos = p.map(p.relativeTicksPos.y[i], 0, 1, y_axis_from, y_axis_to);			// position without scaling factor

			p.line(p.margin.left - 5, p.height - p.margin.bottom - axisPos, p.margin.left + 5, p.height - p.margin.bottom - axisPos);
			
			if (p.abs(axisPos - p.absoluteTicksPos.y[i-1]) > p.minTickLabelDistance) {
				p.text(scalePos.toFixed(2), p.margin.left - 25, p.height - p.margin.bottom - axisPos);
				tickHasLabel.push(true);
			} else if (!tickHasLabel[i-1] && (i < 2 || !tickHasLabel[i-2] || p.abs(axisPos - p.absoluteTicksPos.y[i-2]) > p.minTickLabelDistance)) {
				p.text(scalePos.toFixed(2), p.margin.left - 25, p.height - p.margin.bottom - axisPos);
				tickHasLabel.push(true);					
			} else {
				tickHasLabel.push(false);										
			}
			
			//	remember scaled position on the axis and on PPM scale
			p.absoluteTicksPos.y.push(axisPos);
		}

		// draw axis label
		/*p.noStroke();	
		p.text(p.yData[0].label, p.margin.left * 0.75, p.margin.top / 2);*/
	}
	
	p.addXData = function(data_label, patient_id, patient_age, patient_gender, vox_id, vox_loc, state_id, timepoint, echo_time, scale_vector, cumul_sum, display_value_vector) {
		
		p.xData.push({	label: data_label,						// used when removing a voxel for the button text		
						patient: patient_id,						
						age: patient_age,
						gender: patient_gender,
						voxel_id: vox_id,						// ID of the voxel, e.g. P123456
						voxel_loc: vox_loc,						// location of the voxel, e.g. left prefrontal
						state: state_id,						// ID of the state: 0 = resting, 1 = active
						time: timepoint,						// time in the format "DD.MM.YYYY"
						echotime: echo_time,
						highlighted: false,
						scale_orig: scale_vector,				// chemical shift scale (PPM)
						values_disp: display_value_vector,		// Data values as deviations from the baseline, normalized between 0 and 1 for displaying the curve
						c_sum: cumul_sum,						// cumulative sum, based on data with normaized peak height (sign preserved)
						tile_values: [],						// values shrinked to size of each tile, used only for drawing the curves, based on values_disp
						tile_integrals: []	});					// values of the integral of the tile, computed using the cumulative sum

		p.refreshTileValues_X();
		p.countIntegrals();
		p.countExpandedRatios();
	}
	
	p.addYData = function(data_label, patient_id, patient_age, patient_gender, vox_id, vox_loc, state_id, timepoint, echo_time, scale_vector, cumul_sum, display_value_vector) {

		p.yData.push({	label: data_label,						// used when removing a voxel for the button text		
						patient: patient_id,						
						age: patient_age,
						gender: patient_gender,
						voxel_id: vox_id,						// ID of the voxel, e.g. P123456
						voxel_loc: vox_loc,						// location of the voxel, e.g. left prefrontal
						state: state_id,						// ID of the state: 0 = resting, 1 = active
						time: timepoint,						// time in the format "DD.MM.YYYY"
						echotime: echo_time,
						highlighted: false,
						scale_orig: scale_vector,				// chemical shift scale (PPM)
						values_disp: display_value_vector,		// Data values as deviations from the baseline, normalized between 0 and 1 for displaying the curve
						c_sum: cumul_sum,						// cumulative sum, based on data with normaized peak height (sign preserved)
						tile_values: [],						// values shrinked to size of each tile, used only for drawing the curves, based on values_disp
						tile_integrals: []	});					// values of the integral of the tile, computed using the cumulative sum
					
		p.refreshTileValues_Y();			
		p.countIntegrals();
		p.countExpandedRatios();
	}
	
	p.refreshTileValues_X = function() {
		if (p.xData.length > 0) {
			
			var x_axis_from = p.xData[0].scale_orig[0];
			var x_axis_to = p.xData[0].scale_orig[p.xData[0].scale_orig.length-1];
			
			for (var tile = 0; tile < p.tileCount.x; tile++) {
				//	count coordinates of the tile
				var x_from = Math.floor(p.relativeTicksPos.x[tile] * p.axisLength.x);
				var x_to = Math.floor(p.relativeTicksPos.x[tile+1] * p.axisLength.x) - 1;
				
				// 	get PPM scale range
				var x_from_scale = p.map(p.relativeTicksPos.x[tile], 0, 1, x_axis_from, x_axis_to);
				var x_to_scale = p.map(p.relativeTicksPos.x[tile+1], 0, 1, x_axis_from, x_axis_to);
				
				//	get corrresponding subset of spectral values
				var index_from = p.xData[0].scale_orig.findIndex(function(element) {
					return element <= x_from_scale;
				});
				
				var index_to = p.xData[0].scale_orig.findIndex(function(element) {
					return element <= x_to_scale;
				});
				
				//	shrink or expand tiles in all vectors on X axis
				var len = (x_to - x_from) * p.tileScales.x[tile];
				
				for (var i = 0; i < p.xData.length; i++) {
					var tile_data = resizeArray(p.xData[i].values_disp.slice(index_from, index_to), len);
					
					p.xData[i].tile_values[tile] = tile_data;
				}
			}
		}
	}
	
	p.refreshTileValues_Y = function() {
		if (p.yData.length > 0) {
			
			var y_axis_from = p.yData[0].scale_orig[0];
			var y_axis_to = p.yData[0].scale_orig[p.yData[0].scale_orig.length-1];
			
			for (var tile = 0; tile < p.tileCount.y; tile++) {
				//	count coordinates of the tile
				var y_from = Math.floor(p.relativeTicksPos.y[tile] * p.axisLength.y);
				var y_to = Math.floor(p.relativeTicksPos.y[tile+1] * p.axisLength.y) - 1;
				
				// 	get PPM scale range
				var y_from_scale = p.map(p.relativeTicksPos.y[tile], 0, 1, y_axis_from, y_axis_to);
				var y_to_scale = p.map(p.relativeTicksPos.y[tile+1], 0, 1, y_axis_from, y_axis_to);
				
				//	get corresponding subset of spectral values
				var index_from = p.yData[0].scale_orig.findIndex(function(element) {
					return element <= y_from_scale;
				});
				
				var index_to = p.yData[0].scale_orig.findIndex(function(element) {
					return element <= y_to_scale;
				});
				
				//	shrink or expand tiles in  all vectors on Y axis
				var len = (y_to - y_from) * p.tileScales.y[tile];
				
				for (var i = 0; i < p.yData.length; i++) {
					var tile_data = resizeArray(p.yData[i].values_disp.slice(index_from, index_to), len);
					
					p.yData[i].tile_values[tile] = tile_data;
				}
			}
		}
	}
	
	p.countIntegrals = function() {
		if (p.xData.length == 0 || p.yData.length == 0) return;		
		
		for (var x = 0; x < p.tileCount.x; x++) {
			//	count boundaries of the tile in original vector (not resized)
			var x_from = Math.floor(p.map(p.relativeTicksPos.x[x], 0, 1, 0, p.xData[0].scale_orig.length-1));
			var x_to = Math.floor(p.map(p.relativeTicksPos.x[x+1], 0, 1, 0, p.xData[0].scale_orig.length-1));

			//	approximate integrals			
			for (var i = 0; i < p.xData.length; i++) {
				if (x_from == 0) p.xData[i].tile_integrals[x] = p.xData[i].c_sum[x_to];
				else p.xData[i].tile_integrals[x] = p.xData[i].c_sum[x_to] - p.xData[i].c_sum[x_from-1];
			}
		}
		
		for (var y = 0; y < p.tileCount.y; y++) {
			//	count boundaries of the tile in original vector (not resized)
			var y_from = Math.floor(p.map(p.relativeTicksPos.y[y], 0, 1, 0, p.yData[0].scale_orig.length-1));
			var y_to = Math.floor(p.map(p.relativeTicksPos.y[y+1], 0, 1, 0, p.yData[0].scale_orig.length-1));

			//	approximate integrals			
			for (var i = 0; i < p.yData.length; i++) {
				if (y_from == 0) p.yData[i].tile_integrals[y] = p.yData[i].c_sum[y_to];
				else p.yData[i].tile_integrals[y] = p.yData[i].c_sum[y_to] - p.yData[i].c_sum[y_from-1];
			}
		}
	}
	
	// put data from both axes to one array and sort according to hierarchy in nested glyphs
	p.collapseAndSortData = function() {		
		if (p.xData.length == 0 && p.yData.length == 0) return;
		
		if (p.xData.length == 0) {			
			p.xyData_sorted = [...p.yData];
			
		} else if (p.yData.length == 0) {			
			p.xyData_sorted = [...p.xData];
			
		} else {			
			p.xyData_sorted = [...p.xData, ...p.yData];
		}
		
		p.xyData_sorted.sort(function(a, b){						
			if (a.voxel_loc == b.voxel_loc) {
				if (a.patient == b.patient ) {
					if (a.state == b.state) {
						
						var day_a = parseInt(a.time.split('.')[0]);
						var mon_a = parseInt(a.time.split('.')[1]);
						var year_a = parseInt(a.time.split('.')[2]);
						
						var day_b = parseInt(b.time.split('.')[0]);
						var mon_b = parseInt(b.time.split('.')[1]);
						var year_b = parseInt(b.time.split('.')[2]);
						
						var time_a = day_a + mon_a * 31 + year_a * 12 * 31;
						var time_b = day_b + mon_b * 31 + year_b * 12 * 31;
						
						return (time_a < time_b) ? -1 : (time_a > time_b) ? 1 : 0;
					} else {
						return (a.state < b.state) ? -1 : (a.state > b.state) ? 1 : 0;
					}
				} else {
					return (a.patient < b.patient) ? -1 : (a.patient > b.patient) ? 1 : 0;
				}
			} else {
				return (a.voxel_loc < b.voxel_loc) ? -1 : (a.voxel_loc > b.voxel_loc) ? 1 : 0;
			}
		});
	}
	
	p.countExpandedRatios = function() {		
		if (p.xData.length == 0 && p.yData.length == 0) return;
		
		var x_scale_from;
		var x_scale_to;
		var y_scale_from;
		var y_scale_to;	
				
		if (p.xData.length == 0) {
			x_scale_from = Math.floor(p.map(p.relativeTicksPos.x[p.tileExpanded.x], 0, 1, 0, p.yData[0].scale_orig.length-1));
			x_scale_to = Math.floor(p.map(p.relativeTicksPos.x[p.tileExpanded.x+1], 0, 1, 0, p.yData[0].scale_orig.length-1));
			y_scale_from = Math.floor(p.map(p.relativeTicksPos.y[ p.tileExpanded.y], 0, 1, 0, p.yData[0].scale_orig.length-1));
			y_scale_to = Math.floor(p.map(p.relativeTicksPos.y[p.tileExpanded.y+1], 0, 1, 0, p.yData[0].scale_orig.length-1));	
						
		} else if (p.yData.length == 0) {
			x_scale_from = Math.floor(p.map(p.relativeTicksPos.x[p.tileExpanded.x], 0, 1, 0, p.xData[0].scale_orig.length-1));
			x_scale_to = Math.floor(p.map(p.relativeTicksPos.x[p.tileExpanded.x+1], 0, 1, 0, p.xData[0].scale_orig.length-1));
			y_scale_from = Math.floor(p.map(p.relativeTicksPos.y[ p.tileExpanded.y], 0, 1, 0, p.xData[0].scale_orig.length-1));
			y_scale_to = Math.floor(p.map(p.relativeTicksPos.y[p.tileExpanded.y+1], 0, 1, 0, p.xData[0].scale_orig.length-1));	
						
		} else {
			x_scale_from = Math.floor(p.map(p.relativeTicksPos.x[p.tileExpanded.x], 0, 1, 0, p.xData[0].scale_orig.length-1));
			x_scale_to = Math.floor(p.map(p.relativeTicksPos.x[p.tileExpanded.x+1], 0, 1, 0, p.xData[0].scale_orig.length-1));
			y_scale_from = Math.floor(p.map(p.relativeTicksPos.y[ p.tileExpanded.y], 0, 1, 0, p.yData[0].scale_orig.length-1));
			y_scale_to = Math.floor(p.map(p.relativeTicksPos.y[p.tileExpanded.y+1], 0, 1, 0, p.yData[0].scale_orig.length-1));	
			
		}
		
		p.expanded_data = [];
		
		for (var data_pos = 0; data_pos < p.xyData_sorted.length; ) {	
			
			// process voxels
				
			var voxel_x_avg = 0;
			var voxel_y_avg = 0;
			var voxel_data_len = 0;
			var patients_data = [];
		
			while(data_pos < p.xyData_sorted.length) {
				
				// process patients
				
				var patient_x_avg = 0;
				var patient_y_avg = 0;
				var patient_data_len = 0;
				var states_data = [];
				
				while (data_pos < p.xyData_sorted.length) {					
					
					// process states
						
					var state_x_avg = 0;
					var state_y_avg = 0;
					var state_data_len = 0;
					var timepoints_data = [];
					
					while (data_pos < p.xyData_sorted.length) {
						
						// process timepoints
						
						var time_x_avg = 0;
						var time_y_avg = 0;
						var time_data_len = 0;
						var timepoint_voxel_ids = [];
						
						while (data_pos < p.xyData_sorted.length) {						
							
							var integral_x; 
							if (x_scale_from == 0) {
								integral_x = p.xyData_sorted[data_pos].c_sum[x_scale_to];
							} else {
								integral_x = p.xyData_sorted[data_pos].c_sum[x_scale_to] - p.xyData_sorted[data_pos].c_sum[x_scale_from - 1];
							}

							var integral_y;
							if (y_scale_from == 0) {
								integral_y  = p.xyData_sorted[data_pos].c_sum[y_scale_to];
							} else {
								integral_y = p.xyData_sorted[data_pos].c_sum[y_scale_to] - p.xyData_sorted[data_pos].c_sum[y_scale_from - 1];
							}
							
							time_x_avg += integral_x;
							state_x_avg += integral_x;
							patient_x_avg += integral_x;
							voxel_x_avg += integral_x;
							
							time_y_avg += integral_y;
							state_y_avg += integral_y;
							patient_y_avg += integral_y;
							voxel_y_avg += integral_y;	

							timepoint_voxel_ids.push(p.xyData_sorted[data_pos].voxel_id);

							time_data_len++;
							state_data_len++;
							patient_data_len++;
							voxel_data_len++;
							data_pos++;
							
							if (data_pos != 0) {
								if (	data_pos == p.xyData_sorted.length || 
										p.xyData_sorted[data_pos].time != p.xyData_sorted[data_pos - 1].time ||
										p.xyData_sorted[data_pos].state != p.xyData_sorted[data_pos - 1].state ||
										p.xyData_sorted[data_pos].patient != p.xyData_sorted[data_pos - 1].patient ||
										p.xyData_sorted[data_pos].voxel_loc != p.xyData_sorted[data_pos - 1].voxel_loc	) {						
										// all data for this timepoint processed
									
									time_x_avg /= time_data_len;
									time_y_avg /= time_data_len;
									
									var rat, true_rat;
									
									true_rat = time_x_avg / time_y_avg;
									
									// detect whether the ratio would have a negative sign
									var neg = (time_x_avg < 0 && time_y_avg > 0) || (time_x_avg > 0 && time_y_avg < 0);
									
									// count as a positive ratio (needed because of the symmetric transformation)
									time_x_avg = p.abs(time_x_avg);
									time_y_avg = p.abs(time_y_avg);
									
									if (time_x_avg > time_y_avg) {
										rat = time_x_avg / time_y_avg;
										rat -= 1;
									} else {
										rat = - time_y_avg / time_x_avg;
										rat += 1;
									}
									
									timepoints_data.push({	time: p.xyData_sorted[data_pos - 1].time,
															voxel_ids: timepoint_voxel_ids,
															ratio: rat,
															negative: neg,
															true_ratio: true_rat });
									
									break;
								}
							}
						}
						
						if (data_pos != 0) {
							if (	data_pos == p.xyData_sorted.length || 
									p.xyData_sorted[data_pos].state != p.xyData_sorted[data_pos - 1].state ||
									p.xyData_sorted[data_pos].patient != p.xyData_sorted[data_pos - 1].patient ||
									p.xyData_sorted[data_pos].voxel_loc != p.xyData_sorted[data_pos - 1].voxel_loc) {							
									// all data for this state processed
								
								state_x_avg /= state_data_len;
								state_y_avg /= state_data_len;
								
								var rat, true_rat;
								
								true_rat = state_x_avg / state_y_avg;
								
								// detect whether the ratio would have a negative sign
								var neg = (state_x_avg < 0 && state_y_avg > 0) || (state_x_avg > 0 && state_y_avg < 0);
								
								// count as a positive ratio (needed because of the symmetric transformation)
								state_x_avg = p.abs(state_x_avg);
								state_y_avg = p.abs(state_y_avg);
							
								if (state_x_avg > state_y_avg) {
									rat = state_x_avg / state_y_avg;
									rat -= 1;
								} else {
									rat = - state_y_avg / state_x_avg;
									rat += 1;
								}
									
								states_data.push({	state: p.xyData_sorted[data_pos - 1].state,
													ratio: rat,
													negative: neg,
													true_ratio: true_rat,
													timepoints: timepoints_data	});
								
								break;
							}
						}
					}
					
					if (data_pos != 0) {
						if (	data_pos == p.xyData_sorted.length || 
								p.xyData_sorted[data_pos].patient != p.xyData_sorted[data_pos - 1].patient ||
								p.xyData_sorted[data_pos].voxel_loc != p.xyData_sorted[data_pos - 1].voxel_loc	) {								
								// all data for this patient processed
							
							patient_x_avg /= patient_data_len;
							patient_y_avg /= patient_data_len;
							
							var rat, true_rat;
							
							true_rat = patient_x_avg / patient_y_avg;
							
							// detect whether the ratio would have a negative sign
							var neg = (patient_x_avg < 0 && patient_y_avg > 0) || (patient_x_avg > 0 && patient_y_avg < 0);
							
							// count as a positive ratio (needed because of the symmetric transformation)
							patient_x_avg = p.abs(patient_x_avg);
							patient_y_avg = p.abs(patient_y_avg);
							
							if (patient_x_avg > patient_y_avg) {
								rat = patient_x_avg / patient_y_avg;
								rat -= 1;
							} else {
								rat = - patient_y_avg / patient_x_avg;
								rat += 1;
							}
							
								
							patients_data.push({	patient_id: p.xyData_sorted[data_pos - 1].patient,
													ratio: rat,
													negative: neg,
													true_ratio: true_rat,
													states: states_data	});
							
							break;
						}
					}
				}
				
				if (data_pos != 0) {
					if (data_pos == p.xyData_sorted.length || p.xyData_sorted[data_pos].voxel_loc != p.xyData_sorted[data_pos - 1].voxel_loc) {	
						// all data for this voxel location processed
						
						voxel_x_avg /= voxel_data_len;
						voxel_y_avg /= voxel_data_len;
						
						var rat, true_rat;
						
						true_rat = voxel_x_avg / voxel_y_avg;
						
						// detect whether the ratio would have a negative sign
						var neg = (voxel_x_avg < 0 && voxel_y_avg > 0) || (voxel_x_avg > 0 && voxel_y_avg < 0);
						
						// count as a positive ratio (needed because of the symmetric transformation)
						voxel_x_avg = p.abs(voxel_x_avg);
						voxel_y_avg = p.abs(voxel_y_avg);
						
						if (voxel_x_avg > voxel_y_avg) {
							rat = voxel_x_avg / voxel_y_avg;
							rat -= 1;
						} else {
							rat = - voxel_y_avg / voxel_x_avg;
							rat += 1;
						}
						
							
						p.expanded_data.push({	voxel_loc: p.xyData_sorted[data_pos - 1].voxel_loc,
												ratio: rat,
												negative: neg,
												true_ratio: true_rat,
												patients: patients_data	});
						
						break;
					}
				}
			}
		}
	}
		
	//	IMPORTANT: X and Y axis have to be drawn before the tiles and matrix - absolute positions of ticks would not be updated otherwise
	
	p.drawTooltipRatio = function(rat) {
		var mouseText = rat.toFixed(4);
		var wid = p.textWidth(mouseText);
		p.fill(255);
		p.noStroke();
		p.rect(p.mouseX + 3, p.mouseY - 18, p.mouseX + 7 + wid, p.mouseY - 5);
		p.fill(0);
		p.textAlign(p.LEFT, p.CENTER);
		p.text(mouseText, p.mouseX + 5, p.mouseY - 10);
		p.textAlign(p.CENTER, p.CENTER);
	}
	
	p.drawMatrix = function() {
		p.noStroke();
		p.rectMode(p.CORNERS);
		
		var cell_fill_color;
		
		// set highlighting to false
		p.xData.forEach(function(elem){
			elem.highlighted = false;
		});
		p.yData.forEach(function(elem){
			elem.highlighted = false;
		});
		
		for (var x_tile = 0; x_tile < p.tileCount.x; x_tile++) {
			for (var y_tile = 0; y_tile < p.tileCount.y; y_tile++) {
				//	get coordinates of the tiles
				var x_from = p.absoluteTicksPos.x[x_tile];
				var x_to = p.absoluteTicksPos.x[x_tile+1];
				var y_from = p.absoluteTicksPos.y[y_tile+1];
				var y_to = p.absoluteTicksPos.y[y_tile];

				var x_from_rel = p.relativeTicksPos.x[x_tile];
				var y_from_rel = p.relativeTicksPos.y[y_tile];
				
				// get PPM scale coordinates 
				var x_ppm_from = p.map(x_from_rel, 0, 1, p.xData[0].scale_orig[0], p.xData[0].scale_orig[p.xData[0].scale_orig.length-1]);
				var y_ppm_from = p.map(y_from_rel, 0, 1, p.yData[0].scale_orig[0], p.yData[0].scale_orig[p.yData[0].scale_orig.length-1]);
				
				// skip the cutoff area
				if (x_ppm_from < PPM_scale_cutoff || y_ppm_from < PPM_scale_cutoff) {
					
					// draw grey rectangle
					p.fill(168);
					p.rect(	p.margin.left + x_from, p.height - p.margin.bottom - y_from,
							p.margin.left + x_to, p.height - p.margin.bottom - y_to );
							
					continue;
				}
				
				//	get the ratio between X and Y integrals (average of all data on each axis)
				var tile_int_x = 0, tile_int_y = 0;
				var rat;
				
				for (var i=0; i < p.xData.length; i++) {
					tile_int_x += p.xData[i].tile_integrals[x_tile];
				}
				for (var i=0; i < p.yData.length; i++) {
					tile_int_y += p.yData[i].tile_integrals[y_tile];
				}
				tile_int_x /= p.xData.length;
				tile_int_y /= p.yData.length;
				
				// detect whether the ratio would have a negative sign
				var negative = (tile_int_x < 0 && tile_int_y > 0) || (tile_int_x > 0 && tile_int_y < 0);
				
				// count as a positive ratio (needed because of the symmetric transformation)
				tile_int_x = p.abs(tile_int_x);
				tile_int_y = p.abs(tile_int_y);
				
				if (tile_int_x > tile_int_y) {
					rat = tile_int_x / tile_int_y;
					rat -= 1;
				} else {
					rat = - tile_int_y / tile_int_x;
					rat += 1;
				}
				
				// 	map ratio to color
				var col = p.getHeatColor(rat, negative);
				if (x_tile == p.tileExpanded.x && y_tile == p.tileExpanded.y) cell_fill_color = col;
				
				// 	draw the rectangle
				p.fill(col);
				p.rect(	p.margin.left + x_from, p.height - p.margin.bottom - y_from,
						p.margin.left + x_to, p.height - p.margin.bottom - y_to );
						
			}
		}
		
		// show ratio on mousover
		var mouse_over_cell = false;
		
		for (var x_tile = 0; x_tile < p.tileCount.x; x_tile++) {
			for (var y_tile = 0; y_tile < p.tileCount.y; y_tile++) {
				//	get coordinates of the tiles
				var x_from = p.absoluteTicksPos.x[x_tile];
				var x_to = p.absoluteTicksPos.x[x_tile+1];
				var y_from = p.absoluteTicksPos.y[y_tile+1];
				var y_to = p.absoluteTicksPos.y[y_tile];
				
				if (	p.mouseX > p.margin.left + x_from && p.mouseX < p.margin.left + x_to &&
						p.mouseY > p.height - p.margin.bottom - y_from && p.mouseY < p.height - p.margin.bottom - y_to) {
					
					mouse_over_cell = true;
				
					// if cell is expanded, handle tooltip while drawing details
					if (x_tile == p.tileExpanded.x && y_tile == p.tileExpanded.y) {
						break;
					}
						
					//	get the ratio between X and Y integrals
					
					var tile_int_x = 0, tile_int_y = 0;
					var rat;
					
					for (var i=0; i < p.xData.length; i++) {
						tile_int_x += p.xData[i].tile_integrals[x_tile];
					}
					for (var i=0; i < p.yData.length; i++) {
						tile_int_y += p.yData[i].tile_integrals[y_tile];
					}
					tile_int_x /= p.xData.length;
					tile_int_y /= p.yData.length;
					
					// true ratio value for display
					
					var rat = tile_int_x / tile_int_y;
					
					// 	show ratio as tooltip				
							
					p.drawTooltipRatio(rat);
				}
			}
		}
		
		p.noFill();
		p.stroke(0);		
		
		p.rect(p.margin.left, p.height - p.margin.bottom - p.absoluteTicksPos.y[p.tileCount.y], p.margin.left + p.absoluteTicksPos.x[p.tileCount.x], p.height - p.margin.bottom);
				
		p.drawExpandedDetails(cell_fill_color, mouse_over_cell);
	}
	
	p.drawExpandedDetails = function(cell_fill_color, mouse_over_cell) {
		if (p.tileExpanded.x == -1 || p.tileExpanded.y == -1) return;
		
		
		//	get coordinates of the cell
		var x_from = p.absoluteTicksPos.x[p.tileExpanded.x];
		var x_to = p.absoluteTicksPos.x[p.tileExpanded.x+1];
		var y_from = p.absoluteTicksPos.y[p.tileExpanded.y+1];
		var y_to = p.absoluteTicksPos.y[p.tileExpanded.y];	
					
		p.countExpandedRatios();

		p.xyData_sorted.forEach(function(elem){
			elem.highlighted = false;
		});
		
		// store all possible ids to highlight if mouse is in the expanded cell -> filter later
		if (p.mouseX > p.margin.left + x_from && p.mouseX < p.margin.left + x_to &&
						p.mouseY > p.height - p.margin.bottom - y_from && p.mouseY < p.height - p.margin.bottom - y_to) {

			p.xyData_sorted.forEach(function(elem){
				var id = elem.voxel_loc + "_" + elem.patient + "_" + elem.state + "_" + elem.time + "_" + elem.voxel_id;
				ids_to_highlight.push(id);
			});
		}
		
		// check timepoints
		var hasTimepoints = false;
		
		p.expanded_data.forEach(function(location){
			location.patients.forEach(function(patient){				
				patient.states.forEach(function(state){
					hasTimepoints = hasTimepoints || state.timepoints.length > 1;
				});				
			});
		});
		
		var tooltip_rat = -1;

		// branch accroding to the encoding scenarios

		if (p.expanded_data.length == 1 && p.expanded_data[0].patients.length == 1) {	

			// single location, single patient
			if (hasTimepoints) {
				if (p.expanded_data[0].patients[0].states.length > 1) {

					// single location, single patient, dual state, multiple timepoints

					var fill_color_top = p.getHeatColor(p.expanded_data[0].patients[0].states[0].ratio, p.expanded_data[0].patients[0].states[0].negative);
					var fill_color_bottom = p.getHeatColor(p.expanded_data[0].patients[0].states[1].ratio, p.expanded_data[0].patients[0].states[1].negative);
					
					p.fill(fill_color_top);
					if (p.brightness(cell_fill_color) > 80) p.stroke(0);
					else p.stroke(255);
					
					p.rect( p.margin.left + x_from + 5,
							p.height - p.margin.bottom - y_from + 5,
							p.margin.left + x_to - 5,
							p.height - p.margin.bottom - (y_from + y_to) / 2,
							25, 25, 0, 0 );
					
					p.fill(fill_color_bottom);
					
					p.rect( p.margin.left + x_from + 5,
							p.height - p.margin.bottom - (y_from + y_to) / 2,
							p.margin.left + x_to - 5,
							p.height - p.margin.bottom - y_to - 5,
							0, 0, 25, 25 );		
							
					//	draw timepoints
					
					p.drawTimepoints(	p.expanded_data[0].patients[0].states[0].timepoints, 
										p.margin.left + x_from + 5, 
										p.height - p.margin.bottom - y_from + 5, 
										p.margin.left + x_to - 5, 
										p.height - p.margin.bottom - (y_from + y_to) / 2, 
										fill_color_top);
					
					p.drawTimepoints(	p.expanded_data[0].patients[0].states[1].timepoints, 
										p.margin.left + x_from + 5, 
										p.height - p.margin.bottom - (y_from + y_to) / 2, 
										p.margin.left + x_to - 5, 
										p.height - p.margin.bottom - y_to - 5, 
										fill_color_bottom);
										
					// check for mouse 
					
					if (	p.mouseX > p.margin.left + x_from + 5 && p.mouseX < p.margin.left + x_to - 5 &&
							p.mouseY > p.height - p.margin.bottom - y_from + 5 && p.mouseY < p.height - p.margin.bottom - (y_from + y_to) / 2) {
								
						tooltip_rat = p.expanded_data[0].patients[0].states[0].true_ratio;
						
						ids_to_highlight = ids_to_highlight.filter(function(id){
							var ref_id = p.expanded_data[0].voxel_loc + "_" + p.expanded_data[0].patients[0].patient_id + "_" + p.expanded_data[0].patients[0].states[0].state;
							return id.startsWith(ref_id);
						});
						
					} else if (	p.mouseX > p.margin.left + x_from + 5 && p.mouseX < p.margin.left + x_to - 5 &&
								p.mouseY > p.height - p.margin.bottom - (y_from + y_to) / 2 && p.mouseY < p.height - p.margin.bottom - y_to - 5) {
						
						tooltip_rat = p.expanded_data[0].patients[0].states[1].true_ratio;
						
						ids_to_highlight = ids_to_highlight.filter(function(id){
							var ref_id = p.expanded_data[0].voxel_loc + "_" + p.expanded_data[0].patients[0].patient_id + "_" + p.expanded_data[0].patients[0].states[1].state;
							return id.startsWith(ref_id);
						});
					}
					
				} else {

					// single location, single patient, single state, multiple timepoints
					
					var fill_color = p.getHeatColor(p.expanded_data[0].patients[0].ratio, p.expanded_data[0].patients[0].negative);
					
					p.fill(fill_color);
					if (p.brightness(cell_fill_color) > 80) p.stroke(0);
					else p.stroke(255);
					
					p.rect( p.margin.left + x_from + 5,
							p.height - p.margin.bottom - y_from + 5,
							p.margin.left + x_to - 5,
							p.height - p.margin.bottom - y_to - 5,
							25	);
					
					//	draw timepoints
					
					p.drawTimepoints(	p.expanded_data[0].patients[0].states[0].timepoints, 
										p.margin.left + x_from + 5, 
										p.height - p.margin.bottom - y_from + 5, 
										p.margin.left + x_to - 5, 
										p.height - p.margin.bottom - y_to - 5, 
										fill_color);
										
					// check for mouse 
					
					if (	p.mouseX > p.margin.left + x_from + 5 && p.mouseX < p.margin.left + x_to - 5 &&
							p.mouseY > p.height - p.margin.bottom - y_from + 5 && p.mouseY < p.height - p.margin.bottom - y_to - 5) {
								
						tooltip_rat = p.expanded_data[0].patients[0].true_ratio;
						
						ids_to_highlight = ids_to_highlight.filter(function(id){
							var ref_id = p.expanded_data[0].voxel_loc + "_" + p.expanded_data[0].patients[0].patient_id;
							return id.startsWith(ref_id);
						});
						
					}
				}
			} else { 
				
				// single location, single patient, dual state, one timepoint
				var circleDiam = p.min(x_to - x_from - 10, y_from - y_to - 10);
				
				if (p.expanded_data[0].patients[0].states.length > 1) {
					
					var fill_color_top = p.getHeatColor(p.expanded_data[0].patients[0].states[0].ratio, p.expanded_data[0].patients[0].states[0].negative);
					var fill_color_bottom = p.getHeatColor(p.expanded_data[0].patients[0].states[1].ratio, p.expanded_data[0].patients[0].states[1].negative);
					
					p.fill(fill_color_top);
					if (p.brightness(cell_fill_color) > 80) p.stroke(0);
					else p.stroke(255);
					
					p.arc(	p.margin.left + (x_from + x_to) / 2,
							p.height - p.margin.bottom - (y_from + y_to) / 2,
							circleDiam, circleDiam,
							p.PI, 0, p.CHORD );
							
					p.fill(fill_color_bottom);		
					
					p.arc(	p.margin.left + (x_from + x_to) / 2,
							p.height - p.margin.bottom - (y_from + y_to) / 2,
							circleDiam, circleDiam,
							0, p.PI, p.CHORD );
										
					// check for mouse 
							
					if (	p.dist(p.mouseX, p.mouseY, p.margin.left + (x_from + x_to) / 2, p.height - p.margin.bottom - (y_from + y_to) / 2) < circleDiam / 2 &&
							p.mouseY < p.height - p.margin.bottom - (y_from + y_to) / 2) {
								
						tooltip_rat = p.expanded_data[0].patients[0].states[0].true_ratio;
						
						ids_to_highlight = ids_to_highlight.filter(function(id){
							var ref_id = p.expanded_data[0].voxel_loc + "_" + p.expanded_data[0].patients[0].patient_id + "_" + p.expanded_data[0].patients[0].states[0].state;
							return id.startsWith(ref_id);
						});
						
					} else if (	p.dist(p.mouseX, p.mouseY, p.margin.left + (x_from + x_to) / 2, p.height - p.margin.bottom - (y_from + y_to) / 2) < circleDiam / 2 &&
								p.mouseY > p.height - p.margin.bottom - (y_from + y_to) / 2) {
						
						tooltip_rat = p.expanded_data[0].patients[0].states[1].true_ratio;
						
						ids_to_highlight = ids_to_highlight.filter(function(id){
							var ref_id = p.expanded_data[0].voxel_loc + "_" + p.expanded_data[0].patients[0].patient_id + "_" + p.expanded_data[0].patients[0].states[1].state;
							return id.startsWith(ref_id);
						});
					}
					
				} else {				// 1 pt 1 loc 1 state 1 timepoint -> don't draw the circle
				
				}
			}
		} else if (p.expanded_data.length == 1 && p.expanded_data[0].patients.length > 1) {
			
			// single location, multiple patients
			
			var circleDiam = (y_from - y_to) / p.expanded_data[0].patients.length;
			
			var fill_color_voxel = p.getHeatColor(p.expanded_data[0].ratio, p.expanded_data[0].negative);
					
			p.fill(fill_color_voxel);
			if (p.brightness(cell_fill_color) > 80) p.stroke(0);
			else p.stroke(255);
			
			p.rect(	p.margin.left + (x_from * 5 + x_to) / 6,
					p.height - p.margin.bottom - y_from,
					p.margin.left + (x_from + x_to * 5) / 6,
					p.height - p.margin.bottom - y_to,
					25	);
					
			// check for mouse 
			
			if (	p.mouseX > p.margin.left + (x_from * 5 + x_to) / 6 && p.margin.left + (x_from + x_to * 5) / 6 &&
					p.mouseY > p.height - p.margin.bottom - y_from && p.mouseY < p.height - p.margin.bottom - y_to) {
						
				tooltip_rat = p.expanded_data[0].true_ratio;
				
				ids_to_highlight = ids_to_highlight.filter(function(id){
					var ref_id = p.expanded_data[0].voxel_loc;
					return id.startsWith(ref_id);
				});
			}
					
			if (hasTimepoints) {
				for (var pt=0; pt < p.expanded_data[0].patients.length; pt++) {
					if (p.expanded_data[0].patients[pt].states.length > 1) {
						
						// single location, multiple patients, dual state, multiple timepoints
						
						var fill_color_top = p.getHeatColor(p.expanded_data[0].patients[pt].states[0].ratio, p.expanded_data[0].patients[pt].states[0].negative);
						var fill_color_bottom = p.getHeatColor(p.expanded_data[0].patients[pt].states[1].ratio, p.expanded_data[0].patients[pt].states[1].negative);
						
						p.fill(fill_color_top);
						if (p.brightness(fill_color_voxel) > 80) p.stroke(0);
						else p.stroke(255);
						
						var rect_x1 = p.margin.left + (x_from + x_to) / 2 - circleDiam / 2;
						var rect_x2 = p.margin.left + (x_from + x_to) / 2 + circleDiam / 2;
						var rect_y1 = p.height - p.margin.bottom - y_from + pt * circleDiam;
						var rect_y2 = p.height - p.margin.bottom - y_from + (pt + 1) * circleDiam;
						
						p.rect( rect_x1,
								rect_y1,
								rect_x2,
								(rect_y1 + rect_y2) / 2,
								25, 25, 0, 0 );
						
						p.fill(fill_color_bottom);
						
						p.rect( rect_x1,
								(rect_y1 + rect_y2) / 2,
								rect_x2,
								rect_y2,
								0, 0, 25, 25 );		
								
						//	draw timepoints
					
						p.drawTimepoints(	p.expanded_data[0].patients[pt].states[0].timepoints, 
											rect_x1, 
											rect_y1, 
											rect_x2, 
											(rect_y1 + rect_y2) / 2, 
											fill_color_top);
					
						p.drawTimepoints(	p.expanded_data[0].patients[pt].states[1].timepoints, 
											rect_x1, 
											(rect_y1 + rect_y2) / 2, 
											rect_x2, 
											rect_y2, 
											fill_color_bottom);
									
						// check for mouse 
						
						if (	p.mouseX > rect_x1 && p.mouseX < rect_x2 &&
								p.mouseY > rect_y1 && p.mouseY < (rect_y1 + rect_y2) / 2) {
									
							tooltip_rat = p.expanded_data[0].patients[pt].states[0].true_ratio;
							
							ids_to_highlight = ids_to_highlight.filter(function(id){
								var ref_id = p.expanded_data[0].voxel_loc + "_" + p.expanded_data[0].patients[pt].patient_id + "_" + p.expanded_data[0].patients[pt].states[0].state;
								return id.startsWith(ref_id);
							});							
						} else if (	p.mouseX > rect_x1 && p.mouseX < rect_x2 &&
									p.mouseY > (rect_y1 + rect_y2) / 2 && p.mouseY < rect_y1) {
							
							tooltip_rat = p.expanded_data[0].patients[pt].states[1].true_ratio;
							
							ids_to_highlight = ids_to_highlight.filter(function(id){
								var ref_id = p.expanded_data[0].voxel_loc + "_" + p.expanded_data[0].patients[pt].patient_id + "_" + p.expanded_data[0].patients[pt].states[1].state;
								return id.startsWith(ref_id);
							});
						}
					
					} else {

						// single location, multiple patients, single state, multiple timepoints
					
						var fill_color = p.getHeatColor(p.expanded_data[0].patients[pt].ratio, p.expanded_data[0].patients[pt].negative);
						
						p.fill(fill_color);
						if (p.brightness(fill_color_voxel) > 80) p.stroke(0);
						else p.stroke(255);			
						
						var rect_x1 = p.margin.left + (x_from + x_to) / 2 - circleDiam / 2;
						var rect_x2 = p.margin.left + (x_from + x_to) / 2 + circleDiam / 2;
						var rect_y1 = p.height - p.margin.bottom - y_from + pt * circleDiam;
						var rect_y2 = p.height - p.margin.bottom - y_from + (pt + 1) * circleDiam;
						
						p.rect( rect_x1,
								rect_y1,
								rect_x2,
								rect_y2,
								25	);
								
						//	draw timepoints
					
						p.drawTimepoints(	p.expanded_data[0].patients[pt].states[0].timepoints, 
											rect_x1, 
											rect_y1, 
											rect_x2, 
											rect_y2, 
											fill_color);
														
						// check for mouse 
						
						if (	p.mouseX > rect_x1 && p.mouseX < rect_x2 &&
								p.mouseY > rect_y1 && p.mouseY < rect_y2) {
									
							tooltip_rat = p.expanded_data[0].patients[pt].true_ratio;
							
							ids_to_highlight = ids_to_highlight.filter(function(id){
								var ref_id = p.expanded_data[0].voxel_loc + "_" + p.expanded_data[0].patients[pt].patient_id;
								return id.startsWith(ref_id);
							});
						}
					}
				}
			} else {	
				for (var pt=0; pt < p.expanded_data[0].patients.length; pt++) {
					if (p.expanded_data[0].patients[pt].states.length > 1) {
					
						// single location, multiple patients, dual state, one timepoint

						var fill_color_top = p.getHeatColor(p.expanded_data[0].patients[pt].states[0].ratio, p.expanded_data[0].patients[pt].states[0].negative);
						var fill_color_bottom = p.getHeatColor(p.expanded_data[0].patients[pt].states[1].ratio, p.expanded_data[0].patients[pt].states[1].negative);
						
						p.fill(fill_color_top);
						if (p.brightness(fill_color_voxel) > 80) p.stroke(0);
						else p.stroke(255);
						
						var circleCenter_y = p.height - p.margin.bottom - y_from + (pt + 0.5) * circleDiam;
						
						p.arc(	p.margin.left + (x_from + x_to) / 2,
								circleCenter_y,
								circleDiam, circleDiam,
								p.PI, 0, p.CHORD );
								
						p.fill(fill_color_bottom);		
						
						p.arc(	p.margin.left + (x_from + x_to) / 2,
								circleCenter_y,
								circleDiam, circleDiam,
								0, p.PI, p.CHORD );
													
						// check for mouse 
								
						if (	p.dist(p.mouseX, p.mouseY, p.margin.left + (x_from + x_to) / 2, circleCenter_y) < circleDiam / 2 &&
								p.mouseY < p.height - p.margin.bottom - (y_from + y_to) / 2) {
									
							tooltip_rat = p.expanded_data[0].patients[pt].states[0].true_ratio;
							
							ids_to_highlight = ids_to_highlight.filter(function(id){
								var ref_id = p.expanded_data[0].voxel_loc + "_" + p.expanded_data[0].patients[pt].patient_id + "_" + p.expanded_data[0].patients[pt].states[0].state;
								return id.startsWith(ref_id);
							});
							
						} else if (	p.dist(p.mouseX, p.mouseY, p.margin.left + (x_from + x_to) / 2, circleCenter_y) < circleDiam / 2 &&
									p.mouseY > p.height - p.margin.bottom - (y_from + y_to) / 2) {
							
							tooltip_rat = p.expanded_data[0].patients[pt].states[1].true_ratio;
							
							ids_to_highlight = ids_to_highlight.filter(function(id){
								var ref_id = p.expanded_data[0].voxel_loc + "_" + p.expanded_data[0].patients[pt].patient_id + "_" + p.expanded_data[0].patients[pt].states[1].state;
								return id.startsWith(ref_id);
							});
						}
						
					} else {

						// single location, multiple patients, single state, one timepoint
					
						var fill_color = p.getHeatColor(p.expanded_data[0].patients[pt].ratio, p.expanded_data[0].patients[pt].negative);
						
						p.fill(fill_color);
						if (p.brightness(fill_color_voxel) > 80) p.stroke(0);
						else p.stroke(255);
						
						var circleCenter_y = p.height - p.margin.bottom - y_from + (pt + 0.5) * circleDiam;
						
						p.ellipse(	p.margin.left + (x_from + x_to) / 2,
									circleCenter_y,
									circleDiam, circleDiam	);
											
						// check for mouse 
									
						if ( p.dist(p.mouseX, p.mouseY, p.margin.left + (x_from + x_to) / 2, circleCenter_y) < circleDiam / 2 ) {
									
							tooltip_rat = p.expanded_data[0].patients[pt].true_ratio;
							
							ids_to_highlight = ids_to_highlight.filter(function(id){
								var ref_id = p.expanded_data[0].voxel_loc + "_" + p.expanded_data[0].patients[pt].patient_id;
								return id.startsWith(ref_id);
							});
						}			
						
					}
				}
			}
		} else if (p.expanded_data.length > 1) {
			var vox_rect_width = (x_to - x_from) / p.expanded_data.length
			
			for (var vox = 0; vox < p.expanded_data.length; vox++) {
				
				var vox_rect_x_from = x_from + vox * vox_rect_width;
				var vox_rect_x_to = x_from + (vox+1) * vox_rect_width;
				
				if (p.expanded_data[vox].patients.length == 1) {		
					
					// multiple locations, single patient
					
					if (p.expanded_data[vox].patients[0].states.length > 1) {

						// multiple locations, single patient, dual state
					
						var fill_color_top = p.getHeatColor(p.expanded_data[vox].patients[0].states[0].ratio, p.expanded_data[vox].patients[0].states[0].negative);
						var fill_color_bottom = p.getHeatColor(p.expanded_data[vox].patients[0].states[1].ratio, p.expanded_data[vox].patients[0].states[0].negative);
						
						p.fill(fill_color_top);
						if (p.brightness(cell_fill_color) > 80) p.stroke(0);
						else p.stroke(255);
						
						p.rect( p.margin.left + vox_rect_x_from,
								p.height - p.margin.bottom - y_from,
								p.margin.left + vox_rect_x_to,
								p.height - p.margin.bottom - (y_from + y_to) / 2,
								25, 25, 0, 0 );
						
						p.fill(fill_color_bottom);
						
						p.rect( p.margin.left + vox_rect_x_from,
								p.height - p.margin.bottom - (y_from + y_to) / 2,
								p.margin.left + vox_rect_x_to,
								p.height - p.margin.bottom - y_to,
								0, 0, 25, 25 );
								
						if (hasTimepoints) {
							
							//	draw timepoints
					
							p.drawTimepoints(	p.expanded_data[vox].patients[0].states[0].timepoints, 
												p.margin.left + vox_rect_x_from, 
												p.height - p.margin.bottom - y_from, 
												p.margin.left + vox_rect_x_to, 
												p.height - p.margin.bottom - (y_from + y_to) / 2, 
												fill_color_top);
					
							p.drawTimepoints(	p.expanded_data[vox].patients[0].states[1].timepoints, 
												p.margin.left + vox_rect_x_from, 
												p.height - p.margin.bottom - (y_from + y_to) / 2, 
												p.margin.left + vox_rect_x_to, 
												p.height - p.margin.bottom - y_to, 
												fill_color_bottom);												
							
						}
						
						// check for mouse 
					
						if (	p.mouseX > p.margin.left + vox_rect_x_from && p.mouseX < p.margin.left + vox_rect_x_to &&
								p.mouseY > p.height - p.margin.bottom - y_from && p.mouseY < p.height - p.margin.bottom - (y_from + y_to) / 2) {
									
							tooltip_rat = p.expanded_data[vox].patients[0].states[0].true_ratio;
							
							ids_to_highlight = ids_to_highlight.filter(function(id){
								var ref_id = p.expanded_data[vox].voxel_loc + "_" + p.expanded_data[vox].patients[0].patient_id + "_" + p.expanded_data[vox].patients[0].states[0].state;
								return id.startsWith(ref_id);
							});
							
						} else if (	p.mouseX > p.margin.left + vox_rect_x_from && p.mouseX < p.margin.left + vox_rect_x_to &&
									p.mouseY > p.height - p.margin.bottom - (y_from + y_to) / 2 && p.mouseY < p.height - p.margin.bottom - y_to) {
							
							tooltip_rat = p.expanded_data[vox].patients[0].states[1].true_ratio;
							
							ids_to_highlight = ids_to_highlight.filter(function(id){
								var ref_id = p.expanded_data[vox].voxel_loc + "_" + p.expanded_data[vox].patients[0].patient_id + "_" + p.expanded_data[vox].patients[0].states[1].state;
								return id.startsWith(ref_id);
							});
						}
						
					} else {
						
						
						// multiple locations, single patient, single state

						var fill_color = p.getHeatColor(p.expanded_data[vox].patients[0].ratio, p.expanded_data[vox].patients[0].negative);
						
						p.fill(fill_color);
						if (p.brightness(cell_fill_color) > 80) p.stroke(0);
						else p.stroke(255);
						
						p.rect(	p.margin.left + vox_rect_x_from,
								p.height - p.margin.bottom - y_from,
								p.margin.left + vox_rect_x_to,
								p.height - p.margin.bottom - y_to,
								25	);
								
						if (hasTimepoints) {
							
							//	draw timepoints
					
							p.drawTimepoints(	p.expanded_data[vox].patients[0].states[0].timepoints, 
												p.margin.left + vox_rect_x_from, 
												p.height - p.margin.bottom - y_from, 
												p.margin.left + vox_rect_x_to, 
												p.height - p.margin.bottom - y_to, 
												fill_color);
						}
						
						if (	p.mouseX > p.margin.left + vox_rect_x_from && p.mouseX < p.margin.left + vox_rect_x_to &&
								p.mouseY > p.height - p.margin.bottom - y_from && p.mouseY < p.height - p.margin.bottom - y_to ) {
									
							tooltip_rat = p.expanded_data[vox].patients[0].true_ratio;
							
							ids_to_highlight = ids_to_highlight.filter(function(id){
								var ref_id = p.expanded_data[vox].voxel_loc + "_" + p.expanded_data[vox].patients[0].patient_id;
								return id.startsWith(ref_id);
							});
							
						}
					}					

					
				} else {	
					
					// multiple locations, multiple patients
				
					var fill_color = p.getHeatColor(p.expanded_data[vox].ratio, p.expanded_data[vox].negative);
						
					p.fill(fill_color);
					if (p.brightness(cell_fill_color) > 80) p.stroke(0);
					else p.stroke(255);
					
					p.rect(	p.margin.left + vox_rect_x_from,
							p.height - p.margin.bottom - y_from,
							p.margin.left + vox_rect_x_to,
							p.height - p.margin.bottom - y_to,
							25	);
							
					// check the mouse
							
					if (	p.mouseX > p.margin.left + vox_rect_x_from && p.mouseX < p.margin.left + vox_rect_x_to &&
							p.mouseY > p.height - p.margin.bottom - y_from && p.mouseY < p.height - p.margin.bottom - y_to) {
									
						tooltip_rat = p.expanded_data[vox].true_ratio;
						
						ids_to_highlight = ids_to_highlight.filter(function(id){
							var ref_id = p.expanded_data[vox].voxel_loc;
							return id.startsWith(ref_id);
						});
					}
					
					var col_size = 6;
					
					var circleCols = Math.ceil(p.expanded_data[vox].patients.length / col_size);
					
					var circleDiam = Math.min((y_from - y_to - 10) / (Math.min(p.expanded_data[vox].patients.length, col_size)), (vox_rect_x_to - vox_rect_x_from - 5));
					var circleDiam2 = Math.min((y_from - y_to) / (Math.min(p.expanded_data[vox].patients.length, col_size)), (vox_rect_x_to - vox_rect_x_from - 5));
					
					var col_width = (vox_rect_x_to - vox_rect_x_from) / circleCols;
					
					var corner_diam = 50 / Math.max(2, Math.min(p.expanded_data[vox].patients.length, col_size));
					
					for (var pt=0; pt < p.expanded_data[vox].patients.length; pt++) {
						
						var current_col = Math.floor(pt / col_size);
						var circleMid_x = p.margin.left + vox_rect_x_from + col_width * (current_col + 0.5);
						
						if (hasTimepoints) {
						
							var rect_x1 = circleMid_x - circleDiam2 / 2;
							var rect_x2 = circleMid_x + circleDiam2 / 2;
							var rect_y1 = p.height - p.margin.bottom - y_from + (pt % col_size) * circleDiam2;
							var rect_y2 = p.height - p.margin.bottom - y_from + (pt % col_size + 1) * circleDiam2;
							
							if (p.expanded_data[vox].patients[pt].states.length > 1) {								
								
								// multiple locations, multiple patients, dual state, multiple timepoints

								var fill_color_top = p.getHeatColor(p.expanded_data[vox].patients[pt].states[0].ratio, p.expanded_data[vox].patients[pt].states[0].negative);
								var fill_color_bottom = p.getHeatColor(p.expanded_data[vox].patients[pt].states[1].ratio, p.expanded_data[vox].patients[pt].states[1].negative);
								
								p.fill(fill_color_top);
								if (p.brightness(fill_color) > 80) p.stroke(0);
								else p.stroke(255);
								
								p.rect( rect_x1,
										rect_y1,
										rect_x2,
										(rect_y1 + rect_y2) / 2,
										corner_diam, corner_diam, 0, 0 );
								
								p.fill(fill_color_bottom);
								
								p.rect( rect_x1,
										(rect_y1 + rect_y2) / 2,
										rect_x2,
										rect_y2,
										0, 0, corner_diam, corner_diam );		
										
								//	draw timepoints
					
								p.drawTimepoints(	p.expanded_data[vox].patients[pt].states[0].timepoints, 
													rect_x1, 
													rect_y1, 
													rect_x2, 
													(rect_y1 + rect_y2) / 2, 
													fill_color_top);
					
								p.drawTimepoints(	p.expanded_data[vox].patients[pt].states[1].timepoints, 
													rect_x1, 
													(rect_y1 + rect_y2) / 2, 
													rect_x2, 
													rect_y2, 
													fill_color_bottom);
								
								// check for mouse 
					
								if (	p.mouseX > rect_x1 && p.mouseX < rect_x2 &&
										p.mouseY > rect_y1 && p.mouseY < (rect_y1 + rect_y2) / 2) {
											
									tooltip_rat = p.expanded_data[vox].patients[pt].states[0].true_ratio;
							
									ids_to_highlight = ids_to_highlight.filter(function(id){
										var ref_id = p.expanded_data[vox].voxel_loc + "_" + p.expanded_data[vox].patients[pt].patient_id + "_" + p.expanded_data[vox].patients[pt].states[0].state;
										return id.startsWith(ref_id);
									});
									
								} else if (	p.mouseX > rect_x1 && p.mouseX < rect_x2 &&
											p.mouseY > (rect_y1 + rect_y2) / 2 && p.mouseY < rect_y2) {
									
									tooltip_rat = p.expanded_data[vox].patients[pt].states[1].true_ratio;
							
									ids_to_highlight = ids_to_highlight.filter(function(id){
										var ref_id = p.expanded_data[vox].voxel_loc + "_" + p.expanded_data[vox].patients[pt].patient_id + "_" + p.expanded_data[vox].patients[pt].states[1].state;
										return id.startsWith(ref_id);
									});
								}
						
							} else {

								// multiple locations, multiple patients, single state, multiple timepoints

								var fill_color = p.getHeatColor(p.expanded_data[vox].patients[pt].ratio, p.expanded_data[vox].patients[pt].negative);
						
								p.fill(fill_color);
								if (p.brightness(fill_color) > 80) p.stroke(0);
								else p.stroke(255);				
								
								p.rect( rect_x1,
										rect_y1,
										rect_x2,
										rect_y2,
										corner_diam	);
										
								//	draw timepoints
					
								p.drawTimepoints(	p.expanded_data[vox].patients[pt].states[0].timepoints, 
													rect_x1, 
													rect_y1, 
													rect_x2, 
													rect_y2, 
													fill_color);
								
								// check for mouse
									
								if (	p.mouseX > rect_x1 && p.mouseX < rect_x2 &&
										p.mouseY > rect_y1 && p.mouseY < rect_y2) {
											
									tooltip_rat = p.expanded_data[vox].patients[pt].true_ratio;
							
									ids_to_highlight = ids_to_highlight.filter(function(id){
										var ref_id = p.expanded_data[vox].voxel_loc + "_" + p.expanded_data[vox].patients[pt].patient_id;
										return id.startsWith(ref_id);
									});
									
								}
							}
						} else {	
							if (p.expanded_data[vox].patients[pt].states.length > 1) {
								
								// more locations, more patients, dual state, one timepoint

								var fill_color_top = p.getHeatColor(p.expanded_data[vox].patients[pt].states[0].ratio, p.expanded_data[vox].patients[pt].states[0].negative);
								var fill_color_bottom = p.getHeatColor(p.expanded_data[vox].patients[pt].states[1].ratio, p.expanded_data[vox].patients[pt].states[1].negative);
								
								p.fill(fill_color_top);
								if (p.brightness(fill_color) > 80) p.stroke(0);
								else p.stroke(255);
								
								p.arc(	circleMid_x,
										p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2,
										circleDiam, circleDiam,
										p.PI, 0, p.CHORD );
										
								p.fill(fill_color_bottom);		
								
								p.arc(	circleMid_x,
										p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2,
										circleDiam, circleDiam,
										0, p.PI, p.CHORD );
										
								// check for mouse 
								
								if (	p.dist(p.mouseX, p.mouseY, circleMid_x, p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2) < circleDiam2 / 2 &&
										p.mouseY < p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2) {
											
									tooltip_rat = p.expanded_data[vox].patients[pt].states[0].true_ratio;
							
									ids_to_highlight = ids_to_highlight.filter(function(id){
										var ref_id = p.expanded_data[vox].voxel_loc + "_" + p.expanded_data[vox].patients[pt].patient_id + "_" + p.expanded_data[vox].patients[pt].states[0].state;
										return id.startsWith(ref_id);
									});
									
								} else if (	p.dist(p.mouseX, p.mouseY, circleMid_x, p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2) < circleDiam2 / 2 &&
											p.mouseY > p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2) {
									
									tooltip_rat = p.expanded_data[vox].patients[pt].states[1].true_ratio;
							
									ids_to_highlight = ids_to_highlight.filter(function(id){
										var ref_id = p.expanded_data[vox].voxel_loc + "_" + p.expanded_data[vox].patients[pt].patient_id + "_" + p.expanded_data[vox].patients[pt].states[1].state;
										return id.startsWith(ref_id);
									});
								}		
								
							} else {

								// more locations, more patients, single state, one timepoint

								var fill_color = p.getHeatColor(p.expanded_data[vox].patients[pt].ratio, p.expanded_data[vox].patients[pt].negative);
						
								p.fill(fill_color);
								if (p.brightness(fill_color) > 80) p.stroke(0);
								else p.stroke(255);
								
								p.ellipse(	circleMid_x,
											p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2,
											circleDiam, circleDiam	);
											
								// check for mouse 
									
								if ( p.dist(p.mouseX, p.mouseY, circleMid_x, p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2) < circleDiam2 / 2) {
											
									tooltip_rat = p.expanded_data[vox].patients[pt].true_ratio;
							
									ids_to_highlight = ids_to_highlight.filter(function(id){
										var ref_id = p.expanded_data[vox].voxel_loc + "_" + p.expanded_data[vox].patients[pt].patient_id;
										return id.startsWith(ref_id);
									});
									
								}	
							}
						}
					}
				}
			}
		}

		ids_to_highlight.forEach(function(id){
			var vox_id = id.split("_")[4];
			for(var i=0; i < p.xyData_sorted.length; i++) {
				if (p.xyData_sorted[i].voxel_id == vox_id) {
					p.xyData_sorted[i].highlighted = true;
				}
			}
		});
		
		if (tooltip_rat != -1) {
			p.drawTooltipRatio(tooltip_rat);
		} else if (mouse_over_cell) {

			// 	mouse over cell but not over glyphs

			//	get the ratio between X and Y integrals					
			var tile_int_x = 0, tile_int_y = 0;
			var rat;
			
			for (var i=0; i < p.xData.length; i++) {
				tile_int_x += p.xData[i].tile_integrals[p.tileExpanded.x];
			}
			for (var i=0; i < p.yData.length; i++) {
				tile_int_y += p.yData[i].tile_integrals[p.tileExpanded.y];
			}
			tile_int_x /= p.xData.length;
			tile_int_y /= p.yData.length;
			
			// true ratio value for display
			
			var rat = tile_int_x / tile_int_y;
			
			// 	show ratio as tooltip				
					
			p.drawTooltipRatio(rat);
		}
		
		p5_view_L.updateScene();		// highlight in left view
	}
	
	// draw nested sparkline inside a glyph
	p.drawTimepoints = function(timepoints, x_from, y_from, x_to, y_to, bg_color/*, min_rat, max_rat*/) {
		
		var line_len = ((x_to - x_from) * 0.8) / (timepoints.length-1);
		var circle_diam = Math.min(8, line_len / 4);
		
		if (p.brightness(bg_color) > 80) {
			p.fill(0);
			p.stroke(0);
		} else {
			p.fill(255);
			p.stroke(255);
		}
		
		var x_prev, y_prev;
		
		for(var i=0; i < timepoints.length; i++) {
			var y_pos = p.constrain(p.map(timepoints[i].ratio, -10, 10, y_to - 5, y_from + 5), y_from + 5, y_to - 5);
			var x_pos;
			if (timepoints.length % 2 == 1) {
				x_pos = (x_to + x_from) / 2 + (i - Math.floor(timepoints.length/2)) * line_len;
			} else {
				x_pos = (x_to + x_from) / 2 + (i - (timepoints.length/2 - 0.5)) * line_len;
			}
			
			p.ellipse(x_pos, y_pos, circle_diam, circle_diam);
			
			if (i > 0) {
				p.line(x_prev, y_prev, x_pos, y_pos);
			}
			
			x_prev = x_pos;
			y_prev = y_pos;
		}
		
	}
	
	p.updateDataTable = function() {
		$("#right_data_table").empty();
		
		var htmlTableHead = "<tr id=\"table-head\"><th>Voxel ID</th><th>Patient</th><th>State</th><th>Time</th><th>Gender</th><th>Age</th><th>TE</th><th>Location</th></tr>"
		$("#right_data_table").append(htmlTableHead);
		
		p.xyData_sorted.forEach(function(element){
			
			var htmlString;
			if (element.highlighted) {
				htmlString = "<tr class=\"tablerow table-highlighted\" id =\""; 
			} else {
				htmlString = "<tr class=\"tablerow\" id =\"";
			}
			
			htmlString += element.voxel_id + "\"> <td>" + element.voxel_id + "</td><td>" + element.patient + "</td><td>";
			
			if (element.state == 0) htmlString += "resting</td><td>";
			else htmlString += "active</td><td>";
			
			htmlString += 	element.time + "</td>" + 
							"<td>" + element.gender + "</td>" + 
							"<td>" + element.age + "</td>" + 
							"<td>" + element.echotime + "</td>" + 
							"<td>" + element.voxel_loc + "</td>" + "</tr>";
			
			$("#right_data_table").append(htmlString);
		});
	}
	
	p.drawXCurve = function() {
		var y_base = p.height - p.margin.bottom + 35;

		// label
		p.noStroke();
		p.fill(0);
		p.textSize(11.5);
		p.text("Chemical Shift (ppm)", (p.margin.left + p.width - p.margin.right) / 2, y_base - 5);
		
		// draw curves that are not highlighted
		for (var x = 0; x < p.xData.length; x++) {

			if ( p.xData[x].highlighted ) continue;
			
			var x_position = 0;
			
			p.stroke(0);				
			p.noFill();
			
			p.beginShape();
			
			for (var i=0; i < p.tileCount.x; i++) {
				for (var j=0; j < p.xData[x].tile_values[i].length; j++) {
					var val_mapped = p.map(p.xData[x].tile_values[i][j], 0, 1, 0, p.maxPeakHeight);
					p.vertex(p.margin.left + x_position, y_base + val_mapped);
					x_position++;
				}
			}
			
			p.endShape();
		}
		
		// draw highlighted curves
		for (var x = 0; x < p.xData.length; x++) {
			
			if ( !p.xData[x].highlighted ) continue;
			
			var x_position = 0;
			
			p.strokeWeight(2.5);
			p.stroke(255, 0, 255);				
			p.noFill();
			
			p.beginShape();
			
			for (var i=0; i < p.tileCount.x; i++) {
				for (var j=0; j < p.xData[x].tile_values[i].length; j++) {
					var val_mapped = p.map(p.xData[x].tile_values[i][j], 0, 1, 0, p.maxPeakHeight);
					p.vertex(p.margin.left + x_position, y_base + val_mapped);
					x_position++;
				}
			}
			
			p.endShape();
		}
		p.strokeWeight(1);
	}
	
	p.drawYCurve = function() {
		var x_base = p.margin.left - 55;

		// axis label -- not needed
		/*p.noStroke();
		p.fill(0);
		p.textSize(11.5);
		p.text("Chemical Shift (ppm)", x_base, p.margin.top - 10);*/

		// draw curves that are not highlighted
		for (var y = 0; y < p.yData.length; y++) {

			if ( p.yData[y].highlighted ) continue;
			
			var y_position = 0;
			
			p.stroke(0);	
			p.noFill();
			
			p.beginShape();
			
			for (var i=0; i < p.tileCount.y; i++) {
				for (var j=0; j < p.yData[y].tile_values[i].length; j++) {
					var val_mapped = p.map(p.yData[y].tile_values[i][j], 0, 1, 0, p.maxPeakHeight);
					p.vertex(x_base - val_mapped, p.height - p.margin.bottom - y_position);
					y_position++;
				}
			}	
			
			p.endShape();
		}
		
		// draw highlighted curves
		for (var y = 0; y < p.yData.length; y++) {

			if ( !p.yData[y].highlighted ) continue;
			
			var y_position = 0;
			
			p.strokeWeight(2.5);
			p.stroke(255, 0, 255);	
			p.noFill();
			
			p.beginShape();
			
			for (var i=0; i < p.tileCount.y; i++) {
				for (var j=0; j < p.yData[y].tile_values[i].length; j++) {
					var val_mapped = p.map(p.yData[y].tile_values[i][j], 0, 1, 0, p.maxPeakHeight);
					p.vertex(x_base - val_mapped, p.height - p.margin.bottom - y_position);
					y_position++;
				}
			}
			
			p.endShape();
		}
		p.strokeWeight(1);
	}
	
	p.drawDropZone = function() {
		
		// X axis
		
		p.fill(200, 180);
		p.strokeWeight(1);
		p.stroke(0);
		
		p.rect(p.margin.left, p.height - p.margin.bottom, p.width - p.margin.right, p.height);
		
		p.fill(0);
		p.noStroke();
		p.textFont("Arial", 20);
		p.text("Drop here", (p.width - p.margin.right + p.margin.left) / 2, p.height - p.margin.bottom/2);
		
		// Y axis
		
		p.fill(200, 180);
		p.strokeWeight(1);
		p.stroke(0);
		
		p.rect(0, p.margin.top, p.margin.left, p.height - p.margin.bottom);
		
		p.fill(0);
		p.noStroke();
		p.textFont("Arial", 20);
		p.text("Drop here", p.margin.left / 2, (p.height - p.margin.bottom + p.margin.top) / 2);
	}
	
	p.mouseOverCell = function(x, y) {
		//	get coordinates of the tiles
		var x_from = p.absoluteTicksPos.x[x];
		var x_to = p.absoluteTicksPos.x[x+1];
		var y_from = p.absoluteTicksPos.y[y+1];
		var y_to = p.absoluteTicksPos.y[y];				
		
		p.stroke(0, 100, 50);
		p.line(p.margin.left + x_from, p.height - p.margin.bottom - y_from, p.margin.left + x_from, p.height - 30);
		p.line(p.margin.left + x_to, p.height - p.margin.bottom - y_from, p.margin.left + x_to, p.height - 30);
		p.line(20, p.height - p.margin.bottom - y_from, p.margin.left + x_to, p.height - p.margin.bottom - y_from);
		p.line(20, p.height - p.margin.bottom - y_to, p.margin.left + x_to, p.height - p.margin.bottom - y_to);
		
		p.fill(255, 180);
		p.noStroke();
		p.rectMode(p.CORNER);
		var textLength = p.textWidth("0.000") * 1.2;
		
		p.rect((2 * p.margin.left + x_from + x_to) / 2 - textLength/2, p.height - 22 - 8, textLength, 16);
		p.rect(30 - textLength/2, (2 * p.height - 2 * p.margin.bottom - y_from - y_to) / 2 - 8, textLength, 16);
		
		p.rectMode(p.CORNERS);
		
		p.noStroke();
		p.fill(0);
		p.textFont("Arial", 12);
		
		var tile_int_x = 0, tile_int_y = 0;
		
		for (var i=0; i < p.xData.length; i++) {
			tile_int_x += p.xData[i].tile_integrals[x];
		}
		for (var i=0; i < p.yData.length; i++) {
			tile_int_y += p.yData[i].tile_integrals[y];
		}
		tile_int_x /= p.xData.length;
		tile_int_y /= p.yData.length;
		
		p.text(tile_int_x.toFixed(3), (2 * p.margin.left + x_from + x_to) / 2, p.height - 22);
		p.text(tile_int_y.toFixed(3), 30, (2 * p.height - 2 * p.margin.bottom - y_from - y_to) / 2);
		
		
	}
	
	p.mouseOverTick = function() {
		p.fill(50, 120);
		p.stroke(0);
		
		if (p.activeAxis == 0) {
			var tickPos = p.absoluteTicksPos.x[p.activeTick];
			p.rect(p.margin.left + tickPos - 2, p.height - p.margin.bottom - 20, p.margin.left + tickPos + 2, p.height - p.margin.bottom + 5);
		} else {
			var tickPos = p.absoluteTicksPos.y[p.activeTick];
			p.rect(p.margin.left - 5, p.height - p.margin.bottom - tickPos - 2, p.margin.left + 20, p.height - p.margin.bottom - tickPos + 2);			
		}
	}
	
	p.moveTick = function(shift) {
		
		if (p.activeAxis == 0) {
			
			if (p.activeTick == p.tileExpanded.x || p.activeTick == p.tileExpanded.x + 1) return;
			
			if (shift > 0) {
				shift /= p.tileScales.x[p.activeTick];
			} else {
				shift /= p.tileScales.x[p.activeTick-1];
			}				
			
			p.relativeTicksPos.x[p.activeTick] +=  p.map(shift, 0, p.axisLength.x, 0, 1);
			p.refreshTileValues_X();
		} else if (p.activeAxis == 1) {
			
			if (p.activeTick == p.tileExpanded.y || p.activeTick == p.tileExpanded.y + 1) return;
			
			if (shift > 0) {
				shift /= p.tileScales.y[p.activeTick];
			} else {
				shift /= p.tileScales.y[p.activeTick-1];
			}
			
			p.relativeTicksPos.y[p.activeTick] +=  p.map(shift, 0, p.axisLength.y, 0, 1);
			p.refreshTileValues_Y();
		}	
		
		p.countIntegrals();
		//p.mouseMoved();
	}
	
	p.expandCell = function() {
		var tileSizeX = p.relativeTicksPos.x[p.tileExpanded.x+1] - p.relativeTicksPos.x[p.tileExpanded.x];
		var tileSizeY = p.relativeTicksPos.y[p.tileExpanded.y+1] - p.relativeTicksPos.y[p.tileExpanded.y];
		
		var scaleRatioX, scaleRatioY; // proportion of the heatmap the expanded cell is supposed to take up (1 = whole area)
		
		var lastTickX = p.relativeTicksPos.x[p.relativeTicksPos.x.length - 1];
		var lastTickY = p.relativeTicksPos.y[p.relativeTicksPos.y.length - 1];

		if (tileSizeX < 0.5) {
			scaleRatioX = p.map(tileSizeX, 0, 0.5, 0.25, 0.5);
		} else {
			scaleRatioX = tileSizeX;	// do not scale if it already takes up at least half of the space
		}

		if (tileSizeY < 0.5) {
			scaleRatioY = p.map(tileSizeY, 0, 0.5, 0.25, 0.5);
		} else {
			scaleRatioY = tileSizeY;	// do not scale if it already takes up at least half of the space
		}
		
		var shrink_x = (p.axisLength.x * (lastTickX-scaleRatioX)) / (p.tileCount.x);
		var shrink_y = (p.axisLength.y * (lastTickY-scaleRatioY)) / (p.tileCount.y);
		
		for(var i=0; i < p.tileCount.x; i++) {
			var x_from = Math.floor(p.relativeTicksPos.x[i] * p.axisLength.x);
			var x_to = Math.floor(p.relativeTicksPos.x[i+1] * p.axisLength.x) - 1;
			
			var tile_data_length = x_to - x_from;
			
			if (i != p.tileExpanded.x) p.tileScales.x[i] = shrink_x / tile_data_length;
			else p.tileScales.x[i] = (p.axisLength.x * scaleRatioX) / tile_data_length;
		}
		for(var i=0; i < p.tileCount.y; i++) {
			var y_from = Math.floor(p.relativeTicksPos.y[i] * p.axisLength.y);
			var y_to = Math.floor(p.relativeTicksPos.y[i+1] * p.axisLength.y) - 1;
			
			var tile_data_length = y_to - y_from;
			
			if (i != p.tileExpanded.y) p.tileScales.y[i] = shrink_y / tile_data_length;
			else p.tileScales.y[i] = (p.axisLength.y * scaleRatioY) / tile_data_length;
		}
		
		p.refreshTileValues_X();
		p.refreshTileValues_Y();
		p.mouseMoved();
	}
	
	// "value" is represented as the symmetric ratio of absolute values of integrals -> indication whether the result will be negative is needed
	p.getHeatColor = function(value, negative) {		
		var mapped_value = p.constrain(p.map(value, heatmap_limits[0], heatmap_limits[1], 0, 1), 0, 1);
		var blank = p.color(100, 100, 100); // declare the gray color to use when results are not real numbers
		
		var c;
		if (!negative) c = color_schemes[0](mapped_value);
		else c = color_schemes[1](mapped_value);
		
		// since the "value" is always the larger number divided by the smaller, if one of those is 0, the result is NaN
		
		if (isFinite(value)) {		
			return p.color(c);
		} else {
			return blank;
		}
	}
	
	p.getMetabolites = function(PPMfrom, PPMto) {
		var resultString = "";
		var foundMetabolites = [];
		
		// check according to the table values, note that PPM scale is decreasing, therefore PPMfrom > PPMto
				
		for (var i=0; i < metabolites.length; i++) {
			if (PPMto < chemical_sifts[i] && chemical_sifts[i] < PPMfrom && !foundMetabolites.includes(metabolites[i])) {
				resultString += " " + metabolites[i] + ","; 
				foundMetabolites.push(metabolites[i]);
			}
		}
		
		if (resultString.length != 0) {
			return "Metabolites:" + resultString.slice(0, -1);
		} else {
			return "";
		}
	}
	
	p.refreshData = function() {
		
		if (p.xData.length > 0 || p.yData.length > 0) {			
			p.refreshTileValues_X();
			p.refreshTileValues_Y();
			p.countIntegrals();
			// p.countExpandedRatios();
		}
		p.updateScene();
	}
	
	p.buttonClicked = function(i) {
		switch(i) {
			case 0:
				p.activeDropZone = -1;
				p.resetView();
				p.updateScene();
				break;
			case 1:
				p.xData = [];
				p.yData = [];
				p.xyData_sorted = [];
				p.updateScene();
				p.updateDataTable();

				/*$("#right_data_table").empty();
		
				var htmlTableHead = "<tr id=\"table-head\"><th>Voxel ID</th><th>Patient</th><th>State</th><th>Time</th><th>Gender</th><th>Age</th><th>TE</th><th>Location</th></tr>"
				$("#right_data_table").append(htmlTableHead);*/
				break;
			default:
				if (p.activeDropZone == 0) {
					if (p.xData.length > 1) p.xData.splice(i-2, 1);
					else p.xData = [];
				} else if (p.activeDropZone == 1) {
					if (p.yData.length > 1) p.yData.splice(i-2, 1);
					else p.yData = [];
				}

				p.collapseAndSortData();
				p.updateScene();
				
				if (p.xData.length == 0 && p.yData.length == 0) {
					/*$("#right_data_table").empty();
		
					var htmlTableHead = "<tr id=\"table-head\"><th>Voxel ID</th><th>Patient</th><th>State</th><th>Time</th><th>Gender</th><th>Age</th><th>TE</th><th>Location</th></tr>"
					$("#right_data_table").append(htmlTableHead);*/
					p.updateDataTable();
				}
				
				break;
		}
	}
	
	p.mouseClicked = function() {
		if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;	// skip all mouse events when outside of the window
		
		p.my_buttons = [{caption: "Reset view", position: {x: p.width * 0.85, y: p.height * 0.95}, size: {x: p.width * 0.15 - 2, y: p.height * 0.05 - 2}},
						{caption: "Clear data", position: {x: 0, y: p.height * 0.95}, size: {x: p.width * 0.15 - 2, y: p.height * 0.05 - 2}}];
		
		// remove voxels from axis - show options
		
		if (p.mouseButton == p.RIGHT) {
			var buttonSize = {x: 250, y: 20};
			
			if (p.xData.length > 0 && p.mouseX > p.margin.left && p.mouseY > p.height - p.margin.bottom && p.mouseX < p.width - p.margin.right && p.mouseY < p.height) {
				
				for (var i = 0; i < p.xData.length; i++) {
					p.my_buttons.push({ 	caption: "Remove " + p.xData[i].label, 
										position: {x: p.mouseX, y: p.mouseY + i*buttonSize.y}, 
										size: buttonSize	});
				}
				
				p.activeDropZone = 0;
				p.updateScene();
				return;
				
			} else if (p.yData.length > 0 && p.mouseX > 0 && p.mouseY > p.margin.top && p.mouseX < p.margin.left && p.mouseY < p.height - p.margin.bottom) {
				
				for (var i = 0; i < p.yData.length; i++) {
					p.my_buttons.push({	caption: "Remove " + p.yData[i].label, 
										position: {x: p.mouseX, y: p.mouseY + i*buttonSize.y}, 
										size: buttonSize	});
				}
				
				p.activeDropZone = 1;
				p.updateScene();
				return;
			} else {
				p.activeDropZone = -1;
			}
		}
		
		// handle buttons
		
		if (p.activeButton != -1) {
			p.buttonClicked(p.activeButton);
		} else { 
			p.activeDropZone = -1;
			p.updateScene();
		}
		
		// cell expansion
		
		if (p.mouseX > p.margin.left && p.mouseX < p.width - p.margin.right && p.mouseY > p.margin.top && p.mouseY < p.height - p.margin.bottom && p.activeAxis == -1) {
			var to_expand = {x: -1, y: -1};
		
			for (var x = 0; x < p.relativeTicksPos.x.length; x++) {
				if (p.mouseX - p.margin.left < p.absoluteTicksPos.x[x]) {
					to_expand.x = x-1;
					break;
				}
			}
			
			for (var y = p.relativeTicksPos.y.length-2; y >= 0; y--) {
				if (p.mouseY < (p.height - p.margin.bottom - p.absoluteTicksPos.y[y])) {
					to_expand.y = y ;
					break;
				}
			}
			
			// close if already expanded
			if (to_expand.x == p.tileExpanded.x && to_expand.y == p.tileExpanded.y && p.activeTick == -1) {
				p.tileExpanded.x = -1;
				p.tileExpanded.y = -1;
				
				for(var i=0; i < p.tileCount.x; i++) {
					p.tileScales.x[i] = 1;
				}
				for(var i=0; i < p.tileCount.y; i++) {
					p.tileScales.y[i] = 1;
				}
				
				p.refreshTileValues_X();
				p.refreshTileValues_Y();
				p.mouseMoved();
//				p5_view_L.updateScene();		// also update scene if nothing is highlighted anymore TODO: is this redundant?
			} else if (p.activeTick == -1) {
				p.tileExpanded = to_expand;
			}
			
			if (p.tileExpanded.x != -1 && p.tileExpanded.y != -1) {

				var x_from = p.relativeTicksPos.x[p.tileExpanded.x];
				var y_from = p.relativeTicksPos.y[p.tileExpanded.y];
				
				// get PPM scale coordinates
				var x_ppm_from = p.map(x_from, 0, 1, p.xData[0].scale_orig[0], p.xData[0].scale_orig[p.xData[0].scale_orig.length-1]);
				var y_ppm_from = p.map(y_from, 0, 1, p.yData[0].scale_orig[0], p.yData[0].scale_orig[p.yData[0].scale_orig.length-1]);
				
				// skip the cutoff area
				if (x_ppm_from < PPM_scale_cutoff || y_ppm_from < PPM_scale_cutoff) {
					p.tileExpanded.x = -1;
					p.tileExpanded.y = -1;
				} else {
					p.expandCell();
				}
			}
			
		}		
	}
	
	p.mousePressed = function() {
		if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;	// skip all mouse events when outside of the window
		p.mousePrevX = p.mouseX;
		p.mousePrevY = p.mouseY;
	}
	
	p.doubleClicked = function() {
		var buttonSize = {x: 250, y: 20};
			
		if (p.xData.length > 0 && p.mouseX > p.margin.left && p.mouseY > p.height - p.margin.bottom && p.mouseX < p.width - p.margin.right && p.mouseY < p.height) {
			
			for (var i = 0; i < p.xData.length; i++) {
				p.my_buttons.push({ 	caption: "Remove " + p.xData[i].label, 
									position: {x: p.mouseX, y: p.mouseY + i*buttonSize.y}, 
									size: buttonSize	});
			}
			
			p.activeDropZone = 0;
			p.updateScene();
			return;
			
		} else if (p.yData.length > 0 && p.mouseX > 0 && p.mouseY > p.margin.top && p.mouseX < p.margin.left && p.mouseY < p.height - p.margin.bottom) {
			
			for (var i = 0; i < p.yData.length; i++) {
				p.my_buttons.push({	caption: "Remove " + p.yData[i].label, 
									position: {x: p.mouseX, y: p.mouseY + i*buttonSize.y}, 
									size: buttonSize	});
			}
			
			p.activeDropZone = 1;
			p.updateScene();
			return;
		} else {
			p.activeDropZone = -1;
		}
	}
	
	// the drop event
	p.mouseReleased = function() {
		if (dragged_data == null) return;
		
		if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) {	// if dropped outside of the window
			dragged_data = null;
			p.cursor(p.ARROW);
			p.updateScene();
			return;	
		}
		
		var data_label = dragged_data.name + ": " + dragged_data.voxel.id;
		/*if (dragged_data.resting_state == 0) data_label += " restnig";
		if (dragged_data.resting_state == 1) data_label += " active";*/
		
		if (p.mouseX > p.margin.left && p.mouseX < p.width - p.margin.right && p.mouseY > p.height - p.margin.bottom) {
						
			p.addXData(	data_label,											// label 
						dragged_data.name,									// patient id
						dragged_data.age,									// patient age
						dragged_data.gender,								// patient gender
						dragged_data.voxel.id,								// voxel id
						dragged_data.voxel.location,						// voxel location
						dragged_data.brain_state,							// brain state (0 or 1)
						dragged_data.time,									// timepoint
						dragged_data.voxel.echotime,						// echo time
						dragged_data.voxel.data[PPM_COL], 					// scale
						dragged_data.voxel.c_sum[DATA_COL-1], 				// cumulative sum
						dragged_data.voxel.displayed_data[DATA_COL-1]	);	// data to display (normalized between 0 and 1)
						
			p.collapseAndSortData();		 	// put data from both axes into one array, sort -> this is used in expanded details computation and to update the table below
			
		} else if (p.mouseX < p.margin.left && p.mouseY > p.margin.top && p.mouseY < p.height - p.margin.bottom) {
			
			p.addYData(	data_label,											// label 
						dragged_data.name,									// patient id
						dragged_data.age,									// patient age
						dragged_data.gender,								// patient gender
						dragged_data.voxel.id,								// voxel id
						dragged_data.voxel.location,						// voxel location
						dragged_data.brain_state,							// brain state (0 or 1)
						dragged_data.time,									// timepoint
						dragged_data.voxel.echotime,						// echo time
						dragged_data.voxel.data[PPM_COL], 					// scale
						dragged_data.voxel.c_sum[DATA_COL-1], 				// cumulative sum
						dragged_data.voxel.displayed_data[DATA_COL-1]	);	// data to display (normalized between 0 and 1)
						
			p.collapseAndSortData();		 	// put data from both axes into one array, sort -> this is used in expanded details computation and to update the table below
		}

		p.updateScene();
		p.mouseMoved();		// update the cursor
		
		dragged_data = null;
	}
	
	p.mouseDragged = function() {
		if (dragged_data != null) {
			//$("html").css("cursor: grabbing");
			p.cursor('grabbing');
			p.updateScene();
			p.drawDropZone();
			return;
		}
		
		if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;	// skip all mouse events when outside of the window
		
		
		// check if a tick should be moved
		
		var shift = 0;
		
		if (p.activeTick != -1) {
			if (p.activeAxis == 0) {
				shift = p.constrain(p.mouseX - p.mousePrevX, 
									p.absoluteTicksPos.x[p.activeTick-1] - p.absoluteTicksPos.x[p.activeTick] + 5, 
									p.absoluteTicksPos.x[p.activeTick+1] - p.absoluteTicksPos.x[p.activeTick] - 5);
			} else {
				shift = p.constrain(p.mousePrevY - p.mouseY, 
									p.absoluteTicksPos.y[p.activeTick-1] - p.absoluteTicksPos.y[p.activeTick] + 5, 
									p.absoluteTicksPos.y[p.activeTick+1] - p.absoluteTicksPos.y[p.activeTick] - 5);				
			}
			
			p.moveTick(shift);
			p.updateScene();
		}
		
		
		p.mousePrevX = p.mouseX;
		p.mousePrevY = p.mouseY;
	}
	
	p.mouseMoved = function() {
		if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;
		
		// check if mouse is over a button - can be done even with incomplete data
		
		p.activeButton = -1;
		
		for(var i=0; i < p.my_buttons.length; i++) {
			if (p.mouseX > p.my_buttons[i].position.x && p.mouseY > p.my_buttons[i].position.y && 
				p.mouseX < p.my_buttons[i].position.x + p.my_buttons[i].size.x && p.mouseY < p.my_buttons[i].position.y + p.my_buttons[i].size.y) {
					
					p.activeButton = i;
					break;
				}
		}
		
		if (p.xData.length == 0 || p.yData.length == 0) {
			if (p.activeButton == -1) p.cursor(p.ARROW, 32, 32);
			else p.cursor(p.HAND, 32, 32);	
			return; 
		}
		
		// check if mouse is over a cell (+ identify the metabolites)
		
		var tile_x = -1, tile_y = -1;
		var metabolites_x = "";
		var metabolites_y = "";
		var axis_from = p.xData[0].scale_orig[0];
		var axis_to = p.xData[0].scale_orig[p.xData[0].scale_orig.length-1];
		
		if (p.mouseX > p.margin.left && p.mouseX < p.width - p.margin.right && p.mouseY > p.margin.top && p.mouseY < p.height - p.margin.bottom) {
			for (var x = 0; x < p.relativeTicksPos.x.length; x++) {
				if (p.mouseX - p.margin.left < p.absoluteTicksPos.x[x]) {
					tile_x = x-1;
					var scale_from = p.map(p.relativeTicksPos.x[x-1], 0, 1, axis_from, axis_to);	
					var scale_to = p.map(p.relativeTicksPos.x[x], 0, 1, axis_from, axis_to);		
					metabolites_x = p.getMetabolites(scale_from, scale_to);
					break;
				}
			}
			
			for (var y = p.relativeTicksPos.y.length-2; y >= 0; y--) {
				if (p.mouseY < (p.height - p.margin.bottom - p.absoluteTicksPos.y[y])) {
					tile_y = y ;
					var scale_from = p.map(p.relativeTicksPos.y[y], 0, 1, axis_from, axis_to);	
					var scale_to = p.map(p.relativeTicksPos.y[y+1], 0, 1, axis_from, axis_to);		
					metabolites_y = p.getMetabolites(scale_from, scale_to);
					break;
				}
			}
		}
		
		
		
		// check if mouse is over a tick on an axis - first and last tick have to stay in place
		
		p.activeAxis = -1;
		p.activeTick = -1;
		
		if (p.abs(p.mouseY - (p.height - p.margin.bottom)) < 10) {
			for (var x = 1; x < p.absoluteTicksPos.x.length-1; x++) {
				if (p.abs(p.mouseX - (p.margin.left + p.absoluteTicksPos.x[x])) < 4) {
					p.activeTick = x;
					break;
				}
			}
			
			p.activeAxis = 0;
		}		
		if (p.activeAxis != 0 && p.abs(p.mouseX - p.margin.left) < 10) {
			for (var y = 1; y < p.absoluteTicksPos.y.length-1; y++) {
				if (p.abs(p.mouseY - (p.height - p.margin.bottom - p.absoluteTicksPos.y[y])) < 4) {
					p.activeTick = y;
					break;
				}
			}
			p.activeAxis = 1;
		}
		
		
		// react
		if (p.activeButton != -1) {
			p.cursor(p.HAND, 32, 32);	
		} else if (p.activeTick != -1) {
			p.updateScene();
			p.mouseOverTick();
			p.cursor('grab', 32, 32);
		} else if (tile_x != -1 && tile_y != -1) {
			p.updateScene();
			p.mouseOverCell(tile_x, tile_y);
			p.cursor(p.CROSS, 16, 16);
		} else {
			p.updateScene();
			p.cursor(p.ARROW, 32, 32);
		}
		
		// display info about metabolites
		
		p.noStroke();	
		p.fill(0);
		p.text(metabolites_x, (p.margin.left + p.width - p.margin.right) / 2, p.height - 10);
		p.text(metabolites_y, p.margin.left * 0.75, p.margin.top / 2);
	}
};

// prevent default behavior on right click
$("#viewR").on('contextmenu', function(evt){
	evt.preventDefault();
});
