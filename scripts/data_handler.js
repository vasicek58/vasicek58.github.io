/**
 * 	SpectraMosaic: Data operations (storage, preprocessing)
 * 
 * 	Developed at University of Bergen, Department of Informatics, by Laura Garrison and Jakub Vašíček
 * 	https://vis.uib.no/publications/Garrison2019SM/
 *  
 * 	Code authorship: Jakub Vašíček
 */

var patient_data = [];		// main container of the data
var dragged_data = null;	// a teporary structure for the data being dragged over to the right panel

const PPM_COL = 0;			// columns inside the CSV file, equivalent to columns in the data and properties of the voxel
const DATA_COL = 1;
const FIT_COL = 2;
const BASELINE_COL = 3;

var spectrum_length = 1024;

// stores a voxel for the left panel view (selection)
function addVoxel(patient_name, vox_location, vox_id, vox_data, png_location_image, state_no, time_point, patient_gender, patient_age, echo_time) {
	
	var datapoint = {	location: vox_location,
						id: vox_id,
						loc_image: png_location_image,
						echotime: echo_time,
						data: vox_data,				// original data
						highlighted: false,
						c_sum: [],					// cumulative sum for easier integral computation -- added after normalization
						normalized_data: [],		// normalized peak height, sign preserved (i.e. values are between -1 and 1) -- added during normalization
					 	displayed_data: []	};		// normalized value between 0 and 1 for displaying the curve -- added during normalization
	
	// initialize columns for normalized and displayed data (one column less than in original data -- will skip PPM scale)
	for (var col=0; col < vox_data.length-1; col++) {
		datapoint.normalized_data.push([]);
		datapoint.displayed_data.push([]);
		datapoint.c_sum.push([]);
	}

	var patient_idx = patient_data.findIndex(function(element){
		return element.name == patient_name;
	});
	
	// check if a patient of this name already exists -- if not create a new one
	
	if (patient_idx == -1) {	
		
		var new_state = { 	state: state_no,
							highlighted: false,
							voxels: [datapoint]};
		
		var new_timepoint = { time: time_point, 
							  highlighted: false,
				  			  states: [new_state] };
							  
		var new_patient = {	name: patient_name,
							gender: patient_gender,
							age: patient_age,
							highlighted: false,
							timepoints: [new_timepoint]	};
							
		patient_data.push(new_patient);
	} else {

		// check if data from this timepoint for this patient exist -- if not create new timepoint, and insert accordingly into the array 
		// (not just push, it would not be sorted)

		var time_idx = patient_data[patient_idx].timepoints.findIndex(function(element){
			return element.time == time_point;
		});
		
		if (time_idx == -1) {

			var time_array_pos = patient_data[patient_idx].timepoints.findIndex(function(element){						
				var day_a = parseInt(element.time.split('.')[0]);
				var mon_a = parseInt(element.time.split('.')[1]);
				var year_a = parseInt(element.time.split('.')[2]);
				
				var day_b = parseInt(time_point.split('.')[0]);
				var mon_b = parseInt(time_point.split('.')[1]);
				var year_b = parseInt(time_point.split('.')[2]);
				
				var time_a = day_a + mon_a * 31 + year_a * 12 * 31;
				var time_b = day_b + mon_b * 31 + year_b * 12 * 31;

				return time_a > time_b;
			});
			
			var new_state = { 	state: state_no,
								highlighted: false,
								voxels: [datapoint]};
			
			var new_timepoint = { time: time_point, 
								  highlighted: false,
								  states: [new_state] };
								  
			if (time_array_pos != -1) patient_data[patient_idx].timepoints.splice(time_array_pos, 0, new_timepoint);
			else patient_data[patient_idx].timepoints.push(new_timepoint);

		} else {

			// check if data form this brain state for timepoint and this patient exist -- if not create new state
			// make sure that state 0 (resting) is always first 
			
			var state_idx = patient_data[patient_idx].timepoints[time_idx].states.findIndex(function(element){
				return element.state == state_no;
			});
			
			if (state_idx == -1) {
				var new_state = { 	state: state_no,
									highlighted: false,
									voxels: [datapoint]};

				if (state_no == 1) patient_data[patient_idx].timepoints[time_idx].states.push(new_state);
				else patient_data[patient_idx].timepoints[time_idx].states.splice(0, 0, new_state);	
						
			} else {

				// check if a voxel of this ID has not been loaded already -- skip if this is the case
				
				var datapoint_idx = patient_data[patient_idx].timepoints[time_idx].states[state_idx].voxels.findIndex(function(element){
					return (element.id == vox_id);
				});
				
				if (datapoint_idx == -1) patient_data[patient_idx].timepoints[time_idx].states[state_idx].voxels.push(datapoint);					
			}
						
		}
	}
}

function resizeArray(input_array, new_size) {
	if (input_array.length > new_size) return downsampleArray(input_array, new_size);
	if (input_array.length < new_size) return upsampleArray(input_array, new_size);
	
	return input_array;	// if the size matches
}

//	Returns an array of a desired size, samples are merged by averaging in bins
function downsampleArray(input_array, new_size) {
	if (input_array.length < new_size) {
		console.error("Downsample: input array size smaller than desired: " + input_array.length);
		return null;
	}
	
	var ratio = input_array.length / new_size;
	var diff = 0;
	var new_array = [];
	
	var orig_pos = 0;
	
	for (var i = 0; i < new_size; i++) {
		var step = Math.min(Math.floor(ratio), input_array.length - orig_pos);
		if (diff > 1) {
			step += 1;
		}
		
		diff += ratio - step;
		
		var avg = 0;
		for (var acc = 0; acc < step; acc++) {
			avg += input_array[orig_pos + acc];
		}
		avg /= step;
		
		new_array.push(avg);
		
		orig_pos += step;
	}
	
	//console.log("Resized: " + (input_array.length - orig_pos));
	
	return new_array;
}

//	Returns an array of a desired size, new samples are created by linear interpolation
function upsampleArray(input_array, new_size) {
	if (input_array.length > new_size) {
		console.error("Upsample: input array size larger than desired: " + input_array.length);
		return null;
	}
	
	var new_array = [];
	
	for (var i=0; i < input_array.length-1; i ++) {
		
		// fill in original values
		
		var output_index_1 = Math.round(p5_view_L.map(i, 0, input_array.length-1, 0, new_size-1));		// use p5 mapping function from an instance of p5
		var output_index_2 = Math.round(p5_view_L.map(i+1, 0, input_array.length-1, 0, new_size-1));
		
		new_array[output_index_1] = input_array[i];
		new_array[output_index_2] = input_array[i+1];
		
		// interpolate in between
		
		var empty_spaces = output_index_2 - output_index_1 - 1;
		
		for (var j=1; j <= empty_spaces; j++) {
			new_array[output_index_1 + j] = (empty_spaces+1 - j) / (empty_spaces+1) * new_array[output_index_1] + 
											j / (empty_spaces+1) * new_array[output_index_2];
		}
	}
	
	return new_array;
}

function preprocessLoadedData(data) {
	if (data == null) {
		console.error("Preprocess: no data was loaded.");
		return null;
	}
	var processed_data = [];
	
	for(var col=0; col < data.length; col++) {
		
		// transform data into deviations from baseline (skip PPM scale and baseline)
		if (col != 0 && col != BASELINE_COL) {
			for(var i=0; i < data[col].length; i++) {
				data[col][i] = data[col][i] - data[BASELINE_COL][i];
			}
		}
		
		processed_data.push(resizeArray(data[col], spectrum_length));
		
		//	normalize in a separate function after all loading is done		
	}
	
	return processed_data;
}


function normalizeData() {
	var mins = [];
	var maxes = [];
	
	for(var col=1; col < patient_data[0].timepoints[0].states[0].voxels[0].data.length; col++) {						
		maxes[col-1] = [];
		mins[col-1] = [];
	}
	
	updateProgressBar(100, "Normalizing values");
	
	// for each column and each voxel find the maximal and minimal value
	patient_data.forEach(function(patient){
		patient.timepoints.forEach(function(timepoint){
			timepoint.states.forEach(function(state){
				state.voxels.forEach(function(vox){
					for(var col=1; col < vox.data.length; col++) {
						//var sorted_data = datapoint.data[col].slice().sort(function(a, b){return a - b});	// used this for the quantile, not needed anymore
						
						maxes[col-1].push(Math.max(...vox.data[col]));
						mins[col-1].push(Math.min(...vox.data[col]));
					}
				});				
			});
		});
	});
	
	var global_min = [];
	var global_max = [];
	var max_peak = [];
	
	// determine global maximum and minimum and the highest peak (in any direction) in each column
	for(var i=0; i < mins.length; i++) {
		global_min[i] = Math.min(...mins[i]);
		global_max[i] = Math.max(...maxes[i]);
		max_peak[i] = Math.max(Math.abs(global_max[i]), Math.abs(global_min[i]));
	}	
	
	// normalize all datapoints (not just the new ones)
	patient_data.forEach(function(patient){
		patient.timepoints.forEach(function(timepoint){
			timepoint.states.forEach(function(state){				
				for (var s=0; s < state.voxels.length; s++) {
					
					for (var col=1; col < state.voxels[s].data.length; col++) {						
						for (var j=0; j < state.voxels[s].data[col].length; j++) {

							// use p5 mapping function from an instance of p5
							state.voxels[s].displayed_data[col-1][j] = p5_view_L.map(state.voxels[s].data[col][j], global_min[col-1], global_max[col-1], 0, 1);		

							state.voxels[s].normalized_data[col-1][j] = state.voxels[s].data[col][j] / max_peak[col-1];

							if (j == 0) {
								state.voxels[s].c_sum[col-1][j] = state.voxels[s].normalized_data[col-1][j];
							} else {
								state.voxels[s].c_sum[col-1][j] = state.voxels[s].c_sum[col-1][j-1] + state.voxels[s].normalized_data[col-1][j];
							}
						}
					}
				}
			});
		});
	});
	
	// refresh all computed values (integrals, ratios) in the right view
	p5_view_R.refreshData();
	
	updateProgressBar(100, "Data loaded");
}





