/**
 * 	SpectraMosaic: Legend for the right panel
 * 
 * 	Developed at University of Bergen, Department of Informatics, by Laura Garrison and Jakub Vašíček
 * 	https://vis.uib.no/publications/Garrison2019SM/
 *  
 * 	Code authorship: Jakub Vašíček, Laura Garrison
 */

let viewR_legend = function(p) {
	p.setup = function() {		
		/*var w = parseInt($("#legend").attr("data-sizex")) * gridster_api.options.widget_base_dimensions[0] * 0.4; 
		var h = parseInt($("#legend").attr("data-sizey")) * gridster_api.options.widget_base_dimensions[1] * 0.9; */
		var w = parseInt($("#legend").attr("data-sizex")) * (($( ".gridster" ).width() - gridster_api.options.widget_margins[0]) / 35 - 3) * 0.4; 
		var h = parseInt($("#legend").attr("data-sizey")) * (($( ".gridster" ).height() - gridster_api.options.widget_margins[1]) / 17 - 3) ; 
		
		p.createCanvas(w, h);
				
		p.textAlign(p.CENTER, p.CENTER);
		p.rectMode(p.CORNER);
		
		var textSize = p.ceil(p.width / 10);
		p.textFont("Arial", textSize);
	}
	
	p.draw = function() {
		p.update();
		p.noLoop();
	}
	
	p.update = function() {
		//p.background("#EFEFEF");
		p.background(255);
		
		var granularity = 800;
		
		var y_start = p.height * 0.12;
		var y_end = p.height * 0.9;
		var x1 = p.width * 0.35;
		var x2 = p.width * 0.52;
		
		var thickness = p.width * 0.12;		
		var y_step = p.ceil((y_end - y_start) / granularity)+1;		
		
        p.text("(+) ratio \n value", p.width * 0.22, p.height * 0.05);
        p.text("(-) ratio \n value", p.width * 0.74, p.height * 0.05);		
		
		for (var i=0; i < granularity; i++) {
			var heat_value = p.map(i, 0, granularity, heatmap_limits[0], heatmap_limits[1]);	// value of the symmetric ratio
			var y_pos = p.map(i, 0, granularity, y_start, y_end);

			var ratio_value;	// absolute value of the actual ratio
			if (heat_value < 0) {
				ratio_value = -1 / (heat_value - 1);
			} else {
				ratio_value = heat_value + 1;
			}
			
			var c1 = p5_view_R.getHeatColor(heat_value, false);	// get the color mapping from the two color maps
			var c2 = p5_view_R.getHeatColor(heat_value, true);
			
			p.fill(c1);
			p.noStroke();
			
			p.rect(x1, y_pos, thickness, y_step);
			
			p.fill(c2);
			p.noStroke();
			
			p.rect(x2, y_pos, thickness, y_step);
			
			p.fill(0);
			
			if (i == 0) {
				p.text("> " + ratio_value.toFixed(1), p.width * 0.17, y_pos);
				p.text("< -" + ratio_value.toFixed(1), p.width * 0.85, y_pos);
			} else if (i == granularity-1) {
				p.text("< " + ratio_value.toFixed(2), p.width * 0.17, y_pos);
				p.text("> -" + ratio_value.toFixed(2), p.width * 0.82, y_pos);				
			} else if (i == p.floor(granularity * 0.25)) {				
				p.text(ratio_value.toFixed(2), p.width * 0.2, y_pos);
				p.text("-" + ratio_value.toFixed(2), p.width * 0.8, y_pos);
			} else if (i == p.floor(granularity * 0.75)) {
				//var mid_val = p.map(i, granularity/2, granularity-1, heatmap_limits[1], 1);
				
				p.text(ratio_value.toFixed(2), p.width * 0.2, y_pos);
				p.text("-" + ratio_value.toFixed(2), p.width * 0.8, y_pos);				
			}
		}
		
		// draw the tick for 1 and -1 in the middle		
		p.text(1, p.width * 0.2, (y_end + y_start)/2);
		p.text(-1, p.width * 0.8, (y_end + y_start)/2);
	}
	
	p.resized = function() {		
		var w = parseInt($("#legend").attr("data-sizex")) * (($( ".gridster" ).width() - gridster_api.options.widget_margins[0]) / 35 - 3) * 0.4; 
		var h = parseInt($("#legend").attr("data-sizey")) * (($( ".gridster" ).height() - gridster_api.options.widget_margins[1]) / 17 - 3) ; 
		p.resizeCanvas(w, h);	

		var textSize = p.ceil(p.width / 10);
		p.textFont("Arial", textSize);
		
		p.update();
	}
};
