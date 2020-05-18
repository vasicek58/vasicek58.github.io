To run SpectraMosaic, open the index.html page in your web browser (tested in Firefox, Microsoft Edge and Safari).

** Google Chrome had compatibility issues with the latest update of the File and Directory Entries API (as of April 27, 2020). If you encounter any problems, please use Firefox or Microsoft Edge instead. This issue will be addressed in the future version of the application. **

There are three sample datasets available in the "sample_data" directory: 

- neuroinflammation_set_spatial_study: a dataset of three voxels in two patients, intended for a comparison between spatial locations of the voxels
- neuroinflammation_set_diff_TE_study: a dataset of two voxels in a single patient, intended for a comparison between two values of echo time
- neuroinflammation_set_artificial: an artificially created dataset intended to test all the glyph encoding scenarios, includes both brain states and a time series

To load the data, drag-and-drop the whole directory at the specified widget in the application.

There are also scripts intended for the preparation of data in the format given by GE MR scanners, found in the directory "scripts/spectramosaic_prep". These scripts were prepared by Alex Craven at the University of Bergen and they are not a part of this thesis. The scripts are provided along with the application to provide the possibility of using other data than the sample attached.