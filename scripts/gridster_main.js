/**
 * 	SpectraMosaic: Page layout, main file
 * 
 * 	Developed at University of Bergen, Department of Informatics, by Laura Garrison and Jakub Vašíček
 * 	https://vis.uib.no/publications/Garrison2019SM/
 *  
 * 	Code authorship: Jakub Vašíček
 */

let gridster_api, p5_view_L, p5_view_R, p5_heatmap_legend;


$(function() {
    gridster_api = $(".gridster ul").gridster({
        widget_base_dimensions: ['auto', 45],
        // autogenerate_stylesheet: true,
        min_cols: 30,
        max_cols: 35,
        widget_margins: [5, 5],
        avoid_overlapped_widgets: true,
        helper: 'clone'
    }).data('gridster').disable();

    p5_view_L = new p5(viewL, "viewL");
    p5_view_R = new p5(viewR, "viewR");
	p5_heatmap_legend = new p5(viewR_legend, "viewR_legend");
});

$(window).on('resize', function(){
	// wait for gridster to animate
	setTimeout(function(){
		p5_view_L.resized();
		p5_view_R.resized();
		p5_heatmap_legend.resized();
	}, 200);
});

// make sure the gridster api remains disabled (the panels can't be dragged)
$(window).on('mousemove', function(){
	gridster_api.disable();
});