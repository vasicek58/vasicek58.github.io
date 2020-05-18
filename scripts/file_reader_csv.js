/**
 * 	SpectraMosaic: Data loading operations (read files)
 * 
 * 	Developed at University of Bergen, Department of Informatics, by Laura Garrison and Jakub Vašíček
 * 	https://vis.uib.no/publications/Garrison2019SM/
 *  
 * 	Code authorship: Jakub Vašíček
 */

var loaded_header = null;	// temporary variable for the header information before connected with data
var loaded_data = [];		// temporary structure for data before they are connected with the header information

// callback function when the data is loaded
function csvDataFileLoaded(evt, patient_name, voxel_id, png_file, resolve) {

	var data_text = evt.target.result;
	
	var parsed = d3.csvParseRows(data_text).map(function(row) {
		return row.map(function(value) {
		  return +value;
		});
    });
	
	// initialize table columns
	var data_table = [];
	parsed[0].forEach(function() {
		data_table.push([]);
	});
	
	// copy the data into the table, convert to float
	parsed.forEach(function(row) {
		for(var i=0; i < row.length; i++) {
			data_table[i].push(parseFloat(row[i]));
		}
	});
	
	// preprocessing -- stretch to 1024 samples (interpolate)	
	data_table = preprocessLoadedData(data_table);
	
	// load the png image 	
	png_file.data.file(function(image_file){
		var fileReader_img = new FileReader();
		fileReader_img.onloadend = function(evt){
			pngLocationImageLoaded(evt, patient_name, voxel_id, data_table, resolve);
		};
		
		fileReader_img.readAsDataURL(image_file); // read the image as a base-64 string
	});
}

function csvHeaderFileLoaded(evt) {
	var data_text = evt.target.result;
	
	var dsv = d3.dsvFormat(";");
	
	// parse the data
	var parsed = dsv.parse(data_text);
	
	loaded_header = parsed;
}

/**
 * A callback function for a FileReader.
 * 
 * The image should be read as a base-64 string using the FileReader.readAsDataURL method, it can then be loaded into a p5 Image object directly
 */
function pngLocationImageLoaded(evt, patient_name, voxel_id, data_table, resolve) {
	var base64_string = evt.target.result;

	p5_view_L.loadImage(base64_string, (img) => {
		
		img.loadPixels();
		
		loaded_data.push({patient: patient_name, voxel: voxel_id, data: data_table, image: img});
		
		console.log("Loaded " + voxel_id + ": progress " + Math.floor((loaded_data.length / loaded_voxel_count) * 100));
		
		updateProgressBar(Math.floor((loaded_data.length / loaded_voxel_count) * 100), "Loading data");
		
		resolve(); // all loading for this voxel done -- call resolve to update the Promise created in readVoxel
		
	});
}


