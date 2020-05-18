/**
 * 	SpectraMosaic: Data loading operations (drag-and-drop, traverse directory tree)
 * 
 * 	Developed at University of Bergen, Department of Informatics, by Laura Garrison and Jakub Vašíček
 * 	https://vis.uib.no/publications/Garrison2019SM/
 *  
 * 	Code authorship: Jakub Vašíček
 */

var loadingData = false;
var loaded_voxel_count = 0;		// number of voxels processed, used just for the progress bar

// file input - CSV
function handleFileSelect(evt) {	

    evt.stopPropagation();
    evt.preventDefault();

	if (loadingData) {
		alert("Please wait until current loading is done.")
		return;
	}
    
    evt.dataTransfer = evt.originalEvent.dataTransfer;
    
    var files = evt.dataTransfer.items;
	var foundFiles = [];
	loaded_data = [];
	loaded_header = null;
	loadingData = true;
	p5_view_L.updateScene();
	updateProgressBar(0, "Loading data");
	
	// traverse all directories, create hierarchy: all data -> patient -> voxels
	var proms = [];

	for (var i=0; i < files.length; i++) {  
		var file = files[i].webkitGetAsEntry();

		proms.push(readDirectory(foundFiles, file, ""));
	}

	// wait for everything to be processed before reading the contents
	Promise.all(proms).then(function(){readData(foundFiles);});
}

/**
 * Traverse the directory tree recursively, store all the content with its hierarchy in the tree variable passed as the first parameter.
 * 
 * I'm using the File and Directory Entries API, which is experimental and may not work in all the browsers, 
 * although we did not encounter any issues so far (see https://developer.mozilla.org/en-US/docs/Web/API/File_and_Directory_Entries_API).
 * 
 * I'm wrapping the callback functions in a Promise so that I can wait for the callback functions to finish before reading the data
 */
function readDirectory(tree, item, parent) {
	return new Promise(function(resolve, reject) {
		var result = null;
		
		if (item.isDirectory) {
			
			result = {parentDir: parent, name: item.name, isDirectory: true, isFile: false, contents: []}
			
			var dirReader = item.createReader();

			ReadEntries(dirReader, result.contents, item.name).then(function(){		
				tree.push(result);
				resolve();
			});
			
		} else if (item.isFile) {			
			result = {parentDir: parent, name: item.name, isDirectory: false, isFile: true, data: item};
			
			tree.push(result);
			resolve();		
		}
	});
}

// Promise wrapper for the FileSystemDirectoryReader.readEntries function
function ReadEntries(dirReader, tree, parentname) {
	return new Promise (function(resolve, reject) {
		dirReader.readEntries(function(entries) {
			var proms = []

			entries.forEach(function(entry){
				proms.push(readDirectory(tree, entry, parentname));
			});

			// wait for the whole subtree to be resolved before resolving this node
			Promise.all(proms).then(function() {resolve();});
		}, function(error) {
			console.error(error);
			loadingData = false;
			p5_view_L.updateScene();
		});
	});
}

/**
 * Reads the header and calls readVoxels
 * 
 * Two possible scenarios:
 * 	 	(foundFiles.length == 1) means the parent directory was dropped as a single item
 * 		(foundFiles.length > 1) means only the contents of the parent directory were dropped (i.e. foundFiles contains the header file and patient directories)
 */
function readData(foundFiles) {
	var headerFile;
	
	if (foundFiles.length == 1) {
		headerFile = foundFiles[0].contents.find(function(elem){
			return (elem.isFile && elem.name.includes("header") && elem.name.endsWith(".csv"));
		});
	} else if (foundFiles.length > 1) {		
		headerFile = foundFiles.find(function(elem){
			return (elem.isFile && elem.name.includes("header") && elem.name.endsWith(".csv"));
		});
	}
	
	if (headerFile) {
		headerFile = headerFile.data.file(function(header){
			var fileReader_header = new FileReader();
			fileReader_header.onloadend = (function(evt) { 
				csvHeaderFileLoaded(evt); 
				readVoxels(foundFiles); 
			});		
			fileReader_header.readAsText(header);
		});		
		
	} else {
		alert("Header file not found!");
		loadingData = false;
		return;
	}
}

// To be called after the header is processed -- reads all the patient directories
function readVoxels(foundFiles) {	

	// see how many voxels are to be loaded (used just for the progress bar)
	loaded_voxel_count = 0;
	
	if (foundFiles.length == 1) {
		foundFiles[0].contents.forEach(function(patient) {
			if (patient.isFile) return;
			
			patient.contents.forEach(function(voxel) {
				if (voxel.isFile) return;
				
				loaded_voxel_count++;
			});
		});
		
	} else if (foundFiles.length > 1) {		
		
		foundFiles.forEach(function(patient) {
			if (patient.isFile) return;
			
			patient.contents.forEach(function(voxel) {
				if (voxel.isFile) return;
				
				loaded_voxel_count++;
			});
		});
	}
	
	// process patients

	var proms = [];
	
	if (foundFiles.length == 1) {
		foundFiles[0].contents.forEach(function(patient) {
			if (patient.isFile) return;
			
			patient.contents.forEach(function(voxel) {
				if (voxel.isFile) return;
				
				proms.push(readVoxel(patient.name, voxel.name, voxel.contents));
			});
		});
		
	} else if (foundFiles.length > 1) {		
		
		foundFiles.forEach(function(patient) {
			if (patient.isFile) return;
			
			patient.contents.forEach(function(voxel) {
				if (voxel.isFile) return;
				
				proms.push(readVoxel(patient.name, voxel.name, voxel.contents));
			});
		});
	}

	Promise.all(proms).then(function(){
		finishLoading();
	});
}

// Read the voxel directory -- wrap function inside a Promise, propagate the resolve function into the callbacks
function readVoxel(patient_name, voxel_id, data_files) {
	return new Promise(function(resolve, reject) {
		var csv_file = data_files.find(function(elem){
			return (elem.isFile && elem.name.startsWith(voxel_id) && elem.name.endsWith(".csv"));
		});
		
		var png_file = data_files.find(function(elem){
			return (elem.isFile && elem.name.startsWith(voxel_id) && elem.name.endsWith("ax.png"));
		});
		
		if (!csv_file) {
			alert("Voxel " + voxel_id + ": CSV file not found.");
			loadingData = false;
			p5_view_L.updateScene();
			return;
		} 
		
		if (!png_file) {
			alert("Voxel " + voxel_id + ": PNG file not found.");
			loadingData = false;
			p5_view_L.updateScene();
			return;		
		}
		
		csv_file.data.file(function(data_file){
			
			var fileReader_data = new FileReader();
			fileReader_data.onloadend = function(evt){
				csvDataFileLoaded(evt, patient_name, voxel_id, png_file, resolve);
			};
			var loaded_filename = data_file.name.slice(0, -4);
			console.log("Loading: " + loaded_filename);
			fileReader_data.readAsText(data_file);
		});
	});	
}

// To be called after all data have been loaded, stores and normalizes the data
function finishLoading() {	
	
	loaded_data.forEach(function(vox){
		var header_idx = loaded_header.findIndex(function(row){
			return (row['Voxel ID'] == vox.voxel && row['Patient'] == vox.patient);
		});
		
		if (header_idx == -1) { // header info not found
			alert("Header information for voxel " + vox.voxel + ", patient " + vox.patient + " not found.");
			loadingData = false;
			p5_view_L.updateScene();
			return;	
		}
		
		var state_no = loaded_header[header_idx]['State'] == "resting" ? 0 : 1;
		
		addVoxel(	vox.patient, 							// patient name
					loaded_header[header_idx]['location'],  // voxel location
					vox.voxel,								// voxel ID
					vox.data, 								// voxel data
					vox.image,								// PNG with the location -- TBA
					state_no,								// state
					loaded_header[header_idx]['Time'],		// timepoint 		
					loaded_header[header_idx]['Gender'],	// gender
					loaded_header[header_idx]['Age'],		// age	
					loaded_header[header_idx]['TE']	);		// echo time
	});
	
	normalizeData();
	
	console.log("Data loaded");
	loadingData = false;
	p5_view_L.updateScene();
}

function handleDragOver(evt) {
	evt.stopPropagation();
	evt.preventDefault();
    evt.dataTransfer = evt.originalEvent.dataTransfer;
	evt.dataTransfer.dropEffect = 'copy';
}

$("#drop_zone").on({
	dragenter: function(evt) {
		evt.preventDefault();
	},
	dragleave: function(evt) {
		evt.preventDefault();
	},
	dragover: handleDragOver, 
	drop: handleFileSelect
});