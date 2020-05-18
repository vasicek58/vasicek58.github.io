/**
 * 	SpectraMosaic: Left panel
 * 
 * 	Developed at University of Bergen, Department of Informatics, by Laura Garrison and Jakub Vašíček
 * 	https://vis.uib.no/publications/Garrison2019SM/
 *  
 * 	Code authorship: Jakub Vašíček
 */

let viewL = function(p) {
	
	p.setup = function() {
		var w = parseInt($("#grid_viewL").attr("data-sizex")) * (($( ".gridster" ).width() - gridster_api.options.widget_margins[0]) / 35 - 3); 
		var h = parseInt($("#grid_viewL").attr("data-sizey")) * (($( ".gridster" ).height() - gridster_api.options.widget_margins[1]) / 17 - 3); 
		//var h = parseInt($("#grid_viewL").attr("data-sizey")) * gridster_api.options.widget_base_dimensions[1]; 
		p.createCanvas(w, h);
		
		p.textAlign(p.CENTER, p.CENTER);
		//p.rectMode(p.CORNERS);

		p.margin = {left: Math.round(w / 4), top: Math.round(h / 10), right: Math.round(w / 15), bottom: Math.round(h / 6) };		
		p.canvas_size = [p.width - p.margin.right - p.margin.left, p.height - p.margin.bottom - p.margin.top];
		
		// selected datapoint
		p.chosen_patient = 0;
		p.chosen_timepoint = 0;
		p.chosen_state = 0;
		p.chosen_voxel = 0;
		p.mousover_voxel = -1;
		
		p.y_point_positions = [];
		p.x_point_positions = [];
		
		// mouse action on selectors
		p.active_voxel = -1;
		p.active_patient = -1;
		p.active_timepoint = -1;
		p.active_state = -1;
			
		// patient, time and state the current image of is displayed (needed because of flipping on focus in the right view)
		p.displayed_patient = 0;
		p.displayed_timepoint = 0;
		p.displayed_state = 0;
		p.displayed_voxel = 0;
	};
	
	p.draw = function() {
		p.updateScene();
		p.noLoop();
	};
	
	p.resized = function() {
		var w = parseInt($("#grid_viewL").attr("data-sizex")) * (($( ".gridster" ).width() - gridster_api.options.widget_margins[0]) / 35 - 3); 
		var h = parseInt($("#grid_viewL").attr("data-sizey")) * (($( ".gridster" ).height() - gridster_api.options.widget_margins[1]) / 17 - 3); 
		p.resizeCanvas(w, h);
		
		p.margin = {left: Math.round(w / 4), top: Math.round(h / 10), right: Math.round(w / 15), bottom: Math.round(h / 6) };	
		
		p.updateScene();
	}
	
	p.updateScene = function() {
		p.background(255);
		
		// draw the border of the window
		p.strokeWeight(1);
		p.stroke(0);
		p.noFill();
		p.rect(0, 0, p.width-2, p.height-2);
		
		if (loadingData) {
			p.fill(0);
			p.noStroke();
			p.textFont("Arial", 16);
			p.text("Loading data", p.width/2, p.height/2);				
		} else if (patient_data.length == 0) {
			p.fill(0);
			p.noStroke();
			p.textFont("Arial", 16);
			p.text("No data loaded", p.width/2, p.height/2);				
		} else {
			p.highlightVoxels();
			p.drawLines();
			p.drawVoxelPosition();
		}
	}
	
	// Selectors
	p.drawLines = function() {
		
		// patient selector
		
		p.fill(0);
		p.noStroke();
		p.textFont("Arial", 16);
		p.textAlign(p.LEFT, p.CENTER);
		p.text("Patient ID", 10, p.margin.top * 0.8);
		
		for (var i=0; i < patient_data.length; i++) {
			
			// highlight by grey box
			if ( patient_data[i].highlighted || i == p.displayed_patient ) {	
				p.noStroke();
				p.fill(150, 100);
				p.rect(12, p.margin.top + 10 + i * 20 - 9, 75, 18);				
			}
			p.fill(255);
			
			p.stroke(0);
			p.ellipse(20, p.margin.top + 10 + i * 20, 10, 10 );
			
			p.noStroke();
			p.fill(0);
			p.text(patient_data[i].name, 40,  p.margin.top + 10 + i * 20);
		}
		
		p.textAlign(p.CENTER, p.CENTER);
		
		
		
		// time and state selector
		
		p.stroke(0)
		p.strokeWeight(1.5);
		p.line(p.margin.left, p.height - p.margin.bottom * 0.75, p.width - p.margin.right, p.height - p.margin.bottom * 0.75);
				
		var line_length = p.width - p.margin.right - p.margin.left;
		var point_dist = line_length / (2*patient_data[p.displayed_patient].timepoints.length);

		p.x_point_positions = [];
		
		for (var i=0; i < patient_data[p.displayed_patient].timepoints.length; i++) {
			var x_pos = p.map(i, 0, patient_data[p.displayed_patient].timepoints.length, 0, line_length);
			x_pos += point_dist;
			
			p.x_point_positions.push({x: x_pos, states: []});
			
			p.stroke(0)
			p.strokeWeight(1.5);
			p.line(p.margin.left + x_pos, p.height - p.margin.bottom * 0.75 - 15, p.margin.left + x_pos, p.height - p.margin.bottom * 0.75 + 15);
			
			for (var s=0; s < patient_data[p.displayed_patient].timepoints[i].states.length; s++) {				
				
				p.x_point_positions[p.x_point_positions.length-1].states.push(patient_data[p.displayed_patient].timepoints[i].states[s].state);
				
				var x_shift;	// shift the square to the left (distinguishes the single and dual state)
				
				if (patient_data[p.displayed_patient].timepoints[i].states.length == 2) {	// dual state
					if(patient_data[p.displayed_patient].timepoints[i].states[s].state == 0) {
						x_shift = -15;
					} else {
						x_shift = 0;
					}
				} else {	// single state
					x_shift = -7.5;
				}
				
				// highlight by grey box
				if ((i == p.displayed_timepoint && patient_data[p.displayed_patient].timepoints[i].states[s].state == p.displayed_state) || patient_data[p.displayed_patient].timepoints[i].states[s].highlighted) {
					p.noStroke();
					p.fill(150, 100);
					p.rect(p.margin.left + x_pos + x_shift - 5, p.height - p.margin.bottom * 0.75 - 25, 25, 50);
				} 
				
				if (patient_data[p.displayed_patient].timepoints[i].states[s].state == 0) {
					p.fill(255);
				} else {
					p.fill(0);
				}
				
				p.stroke(0);
				
				//p.ellipse(p.margin.left + x_pos + x_shift, p.height - p.margin.bottom * 0.5 , 20, 20);
				p.rect(p.margin.left + x_pos + x_shift, p.height - p.margin.bottom * 0.75 - 7.5, 15, 15);
			}
		}

		p.fill(0);
		p.noStroke();
		p.textFont("Arial", 16);
		p.text("Acquisition time", (p.margin.left + p.width - p.margin.right) / 2, p.height - p.margin.bottom * 0.4);
		
		// voxel selector		

		p.stroke(0)
		p.strokeWeight(1.5);
		p.line(p.margin.left * 0.85, p.margin.top, p.margin.left * 0.85, p.height - p.margin.bottom);
		
		var voxel_count =  patient_data[p.displayed_patient].timepoints[p.displayed_timepoint].states[p.displayed_state].voxels.length;
		
		p.y_point_positions = [];
		line_length = p.height - p.margin.bottom - p.margin.top;
		point_dist = line_length / (2*voxel_count);
		
		for (var i=0; i < voxel_count; i++) {
			var y_pos = p.map(i, 0, voxel_count, 0, line_length);
			y_pos += point_dist;
			
			p.y_point_positions.push(y_pos);
			
			p.stroke(0);
			
			p.line(p.margin.left * 0.7, p.margin.top + y_pos, p.margin.left * 0.95, p.margin.top + y_pos);
			
			// highlight by grey box
			if (i == p.displayed_voxel || patient_data[p.displayed_patient].timepoints[p.displayed_timepoint].states[p.displayed_state].voxels[i].highlighted) {
				p.noStroke();
				p.fill(150, 100);
				p.rect(p.margin.left * 0.65, p.margin.top + y_pos - 15, p.margin.left * 0.3, 30);
			} 
			
			p.fill(255);
				
			p.stroke(0);
			
			p.ellipse(p.margin.left * 0.85, p.margin.top + y_pos, 20, 20);
		}
		
		p.fill(0);
		p.noStroke();
		p.textSize(16);

		// label at the vertical axis is rotated
		p.push();
		p.translate(p.margin.left * 0.65 - 10, (p.margin.top + p.height - p.margin.bottom) / 2);
		p.rotate(-p.HALF_PI);
		p.text("Spectral voxels", 0, 0);
		p.pop();
		
	}
	
	// Anatomical image with voxel position
	p.drawVoxelPosition = function() {
		
		p.rectMode(p.CORNERS);
		p.fill(0);
		p.rect(p.margin.left, p.margin.top, p.width - p.margin.right, p.height - p.margin.bottom);
		p.rectMode(p.CORNER);
		
		var img, img_info;
		
		if (p.active_voxel == -1){
			img = patient_data[p.displayed_patient].timepoints[p.displayed_timepoint].states[p.displayed_state].voxels[p.displayed_voxel].loc_image;
			
			img_info = p.composeInfoString(p.displayed_patient, p.displayed_timepoint, p.displayed_state, p.displayed_voxel); 
		} else {
			if (p.active_patient == -1) {	// no active patient, just active voxel -> mouse action in left view
				img = patient_data[p.displayed_patient].timepoints[p.displayed_timepoint].states[p.displayed_state].voxels[p.active_voxel].loc_image;		// show a different image on mousover
				img_info = p.composeInfoString(p.displayed_patient, p.displayed_timepoint, p.displayed_state, p.active_voxel); 
			} 
		}
		
		var axisLenY = p.height - p.margin.bottom - p.margin.top;	
		var axisLenX = p.width - p.margin.left - p.margin.right;		
		var s = Math.min(axisLenX, axisLenY);
		
		var scale_factor = s / img.height;
		
		p.imageMode(p.CENTER);
		
		p.image(img, (p.margin.left + p.width - p.margin.right)/2, (p.margin.top + p.height - p.margin.bottom)/2, img.width * scale_factor, img.height * scale_factor);
		
		p.fill(0);
		p.noStroke();
		p.textFont("Arial", 14);
		
		p.text(img_info, (p.margin.left + p.width - p.margin.right)/2, p.margin.top * 0.6);
	}
	
	// Voxel information 
	p.composeInfoString = function(patient_idx, time_idx, state_idx, voxel_idx) {
		var info_string = "Patient " + patient_data[patient_idx].name + ", " + patient_data[patient_idx].timepoints[time_idx].time + ", ";
		if (patient_data[patient_idx].timepoints[time_idx].states[state_idx].state == 0) {
			info_string += "resting, ";
		} else if (patient_data[patient_idx].timepoints[time_idx].states[state_idx].state == 1) {
			info_string += "active, ";
		}
		
		info_string += 	patient_data[patient_idx].timepoints[time_idx].states[state_idx].voxels[voxel_idx].id + " (" + 
						patient_data[patient_idx].timepoints[time_idx].states[state_idx].voxels[voxel_idx].location  + "), TE: " + 
						patient_data[patient_idx].timepoints[time_idx].states[state_idx].voxels[voxel_idx].echotime;
						
		return info_string;				
	}
	
	p.highlightVoxels = function() {
		
		// reset all highlights
		patient_data.forEach(function(patient){
			patient.timepoints.forEach(function(timepoint){
				timepoint.states.forEach(function(state){
					state.voxels.forEach(function(voxel){
						voxel.highlighted = false;
					});
					state.highlighted = false;
				});
				timepoint.highlighted = false;
			});
			patient.highlighted = false;
		});		
		
		if (ids_to_highlight.length == 0) {
			p.displayed_patient = p.chosen_patient;
			p.displayed_timepoint = p.chosen_timepoint;
			p.displayed_state = p.chosen_state;
			p.displayed_voxel = p.chosen_voxel;
			
			return;
		}
				
		var displayed_pt_idx = ids_to_highlight.findIndex(function(id){
			return id.split("_")[1] === patient_data[p.chosen_patient].name;
		});
		
		// determine what patient to draw selectors from and which voxel to show on the anatomical image
		// i.e., set the displayed properties

		if ( displayed_pt_idx != -1 ) {	// patient currently displayed is highlighted
			p.displayed_patient = p.chosen_patient;
			
			var displayed_time_idx = ids_to_highlight.findIndex(function(id){
				return 	id.split("_")[3] === patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].time && 
						id.split("_")[1] === patient_data[p.chosen_patient].name;
			});
			
			if (displayed_time_idx != -1) { // timepoint currently displayed is highlighted
				p.displayed_timepoint = p.chosen_timepoint;
				
				var displayed_state_idx = ids_to_highlight.findIndex(function(id){
					return parseInt(id.split("_")[2]) === patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].states[p.chosen_state].state &&
									id.split("_")[3] === patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].time && 
									id.split("_")[1] === patient_data[p.chosen_patient].name;
				}); 
				
				
				if (displayed_state_idx != -1) { // state currently displayed is highlighted
					p.displayed_state = p.chosen_state;
							
					var displayed_vox_idx = ids_to_highlight.findIndex(function(id){
						return 			id.split("_")[4] === patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].states[p.chosen_state].voxels[p.chosen_voxel].vox_id &&
								parseInt(id.split("_")[2]) === patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].states[p.chosen_state].state &&
										id.split("_")[3] === patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].time && 
										id.split("_")[1] === patient_data[p.chosen_patient].name;
					});
					
					if (displayed_vox_idx != -1) { 	// voxel currently displayed is highlighted
						p.displayed_voxel = p.chosen_voxel
					} else {	// another voxel to be highlighted, patient, state, and timepoint remain the same
						p.displayed_voxel = patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].states[p.chosen_state].voxels.findIndex(function(voxel){
							return voxel.id === ids_to_highlight[displayed_state_idx].split("_")[4];
						});
					}
					
				} else {	// another state to be highlighted, patient and timepoint remain
					
					p.displayed_state = patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].states.findIndex(function(s){
						return s.state === parseInt(ids_to_highlight[displayed_time_idx].split("_")[2]);
					});
					
					p.displayed_voxel = patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].states[p.displayed_state].voxels.findIndex(function(voxel){
						return voxel.id === ids_to_highlight[displayed_time_idx].split("_")[4];
					});
				}
			} else {	// another timepoint to be highlighted, patient remains
				
				p.displayed_timepoint = patient_data[p.chosen_patient].timepoints.findIndex(function(timepoint){
					return timepoint.time === ids_to_highlight[displayed_pt_idx].split("_")[3];
				});
				
				p.displayed_state = patient_data[p.chosen_patient].timepoints[p.displayed_timepoint].states.findIndex(function(s){
					return s.state === parseInt(ids_to_highlight[displayed_pt_idx].split("_")[2]);
				});
				
				p.displayed_voxel = patient_data[p.chosen_patient].timepoints[p.displayed_timepoint].states[p.displayed_state].voxels.findIndex(function(voxel){
					return voxel.id === ids_to_highlight[displayed_pt_idx].split("_")[4];
				});
			}
			
		} else {	// another patient to be highlighted (use the voxel from the first ID to be highlighted)
			p.displayed_patient = patient_data.findIndex(function(patient){
				return patient.name === ids_to_highlight[0].split("_")[1];
			});
			
			p.displayed_timepoint = patient_data[p.displayed_patient].timepoints.findIndex(function(timepoint){
				return timepoint.time === ids_to_highlight[0].split("_")[3];
			});
			
			p.displayed_state = patient_data[p.displayed_patient].timepoints[p.displayed_timepoint].states.findIndex(function(s){
				return s.state === parseInt(ids_to_highlight[0].split("_")[2]);
			});
			
			p.displayed_voxel = patient_data[p.displayed_patient].timepoints[p.displayed_timepoint].states[p.displayed_state].voxels.findIndex(function(voxel){
				return voxel.id === ids_to_highlight[0].split("_")[4];
			});
		}
			
		// set the "highlighted" property to all the elements that should be highlighted

		ids_to_highlight.forEach(function(id_highlighted){
			//var voxel_loc = id_highlighted.split("_")[0];
			var patient = id_highlighted.split("_")[1];
			var state = id_highlighted.split("_")[2];
			var time = id_highlighted.split("_")[3];
			var vox_id = id_highlighted.split("_")[4];
			
			if (patient != patient_data[p.displayed_patient].name) {	
				// patient the current voxel ID belongs to is not displayed -> highlight the selector element
				var patient_idx = patient_data.findIndex(function(element){
					return element.name == patient;
				});
				
				patient_data[patient_idx].highlighted = true;
				
				
			} else if (	time != patient_data[p.displayed_patient].timepoints[p.displayed_timepoint].time || 
					parseInt(state) != patient_data[p.displayed_patient].timepoints[p.displayed_timepoint].states[p.displayed_state].state	) {
					
					// patient the current voxel ID belongs to is dusplayed, but the acquisition (time or state) does not match
					// -> highlight the corresponding selector element on the horizontal axis

					var time_idx = patient_data[p.displayed_patient].timepoints.findIndex(function(element){
						return element.time == time;
					});

					// check if there is a single or dual state in the acquisition
					if (patient_data[p.displayed_patient].timepoints[time_idx].states.length == 1) {	
						patient_data[p.displayed_patient].timepoints[time_idx].states[0].highlighted = true;

					} else {
						// dual state -> find the correct state element to highlight
						var state_idx = patient_data[p.displayed_patient].timepoints[time_idx].states.findIndex(function(element){
							return element.state == parseInt(state);
						});
						
						
						patient_data[p.displayed_patient].timepoints[time_idx].states[state_idx].highlighted = true;
					}
			} else {	

				// patient the current voxel ID belongs to is dusplayed, acquisition (time or state) matches
				// -> highlight the selector element corresponding to the voxel (vertical axis)

				var datapoints_array = patient_data[p.displayed_patient].timepoints[p.displayed_timepoint].states[p.displayed_state].voxels;
			
				
				var datapoint_idx = datapoints_array.findIndex(function(elem){
					return elem.id == vox_id;
				});
				
				patient_data[p.displayed_patient].timepoints[p.displayed_timepoint].states[p.displayed_state].voxels[datapoint_idx].highlighted = true;
			}
		});
	}
	
	p.mouseMoved = function() {
		if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;	// skip all mouse events when outside of the window
		if (patient_data.length == 0) return;
		
		p.updateScene();
		p.active_voxel = -1;
		p.active_patient = -1;
		p.active_timepoint = -1;
		p.active_state = -1;
		
		if (p.abs(p.mouseX - 20) < 20) {								// check mouse over patient selector
			for (var i=0; i < patient_data.length; i++) {
				if (p.abs(p.mouseY - (p.margin.top + 10 + i * 20)) < 7.5) {				
					p.cursor(p.HAND);
					p.active_patient = i;
					break;
				} else {
					p.cursor(p.ARROW);
				}
			}
			
		} else if (p.abs(p.mouseX - p.margin.left * 0.85) < 20) {		// check mouse over voxel selector (vertical)
		
			var voxel_count =  patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].states[p.chosen_state].voxels.length;
			for(var i=0; i < voxel_count; i++) {
				if (p.abs(p.margin.top + p.y_point_positions[i] - p.mouseY) < 20 ) {					
					p.cursor(p.HAND);
					
					p.active_voxel = i;
					
					// tooltip not needed, replaced with a heading
					
					break;
				} else {
					p.cursor(p.ARROW);
				}
			}
		} else if (	p.mouseX > p.margin.left && p.mouseX < p.width - p.margin.right && 
					p.mouseY > p.margin.top && p.mouseY < p.height - p.margin.bottom ) {	// check mouse over voxel
			
			var active_pixel = p.get(p.mouseX, p.mouseY);
			if (active_pixel[0] == active_pixel[2] && active_pixel[0] > active_pixel[1]) {
				
				// tooltip not needed, replaced with a heading
				
				p.active_voxel = p.chosen_voxel; 
				p.cursor('grab');				
			} else {
				p.cursor(p.ARROW);
			}
			
		} else {													// check mouse over time and state selector (horizontal)
			
			var found_timepoint = false;
		
			for(var i=0; i < p.x_point_positions.length; i++) {
				for(var s=0; s < p.x_point_positions[i].states.length; s++) {
										
					var x_shift;
				
					if (p.x_point_positions[i].states.length == 2) {
						if( p.x_point_positions[i].states[s] == 0) {
							x_shift = -7.5;
						} else {
							x_shift = 7.5;
						}
					} else {
						x_shift = 0;
					}
						
					if (p.abs(p.margin.left + p.x_point_positions[i].x + x_shift - p.mouseX) < 7.5 && 
						p.abs(p.mouseY - (p.height - p.margin.bottom * 0.75)) < 7.5) {		
					
						p.cursor(p.HAND);
						
						p.fill(0);
						p.noStroke();
						p.textFont("Arial", 12);
						
						var tooltip_text = patient_data[p.chosen_patient].timepoints[i].time;
						if (p.x_point_positions[i].states[s] == 0){
							tooltip_text += ": resting";
						} else { 
							tooltip_text += ": active";						
						}
						p.text(tooltip_text, p.mouseX, p.mouseY + 30);
						
						p.active_timepoint = i;
						p.active_state = s;
						var found_timepoint = true;
						break;
					} else {
						p.cursor(p.ARROW);
					}
				}
				if (found_timepoint) break;
			}
		}/*else {
			p.cursor(p.ARROW);
		}*/
		
	}
	
	p.mousePressed = function() {
		if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;	// skip all mouse events when outside of the window
		
		if (p.active_voxel != -1) {	// voxel to be dragged over to the right panel
			
			dragged_data = {	name: patient_data[p.chosen_patient].name,
								gender: patient_data[p.chosen_patient].gender,
								age: patient_data[p.chosen_patient].age,
								time: patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].time,
								brain_state: patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].states[p.chosen_state].state,
								voxel: patient_data[p.chosen_patient].timepoints[p.chosen_timepoint].states[p.chosen_state].voxels[p.active_voxel]	};
		}
	}
	
	p.mouseClicked = function() {
		if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;	// skip all mouse events when outside of the window
		
		// check selectors if an element is active

		if (p.active_patient != -1) {
			p.chosen_patient = p.active_patient;
			p.chosen_timepoint = 0;
			p.chosen_state = 0;
			p.chosen_voxel = 0;
		} else if (p.active_timepoint != -1) {
			p.chosen_timepoint = p.active_timepoint;
			p.chosen_state = p.active_state;
			p.chosen_voxel = 0;
		} else if (p.active_voxel != -1) {
			p.chosen_voxel = p.active_voxel;
		}
		
		p.updateScene();
	}
	
	p.mouseDragged = function() {
		
		p.active_voxel = -1;
		p.active_patient = -1;
		p.active_timepoint = -1;
		p.active_state = -1;
		
		p.updateScene();
		
		if (dragged_data != null) {	// change cursor if a voxel is dragged
			p.cursor('grabbing');
		}
	}
};

function updateProgressBar(percent, text) {
	
	// console.log("Update: " + percent + "; " + text);
	
	//$("#progressbar").attr("data-transitiongoal", percent).progressbar();
	
	$("#progressbar").css("width", percent + "%")
					.attr("aria-valuenow", percent)	
					.text(text + " (" + percent + "%)");
}

//$("#grid_viewL").append("<p margin-top=20px>Drag & Drop data to load below");