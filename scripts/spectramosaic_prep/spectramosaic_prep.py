#!/usr/bin/python
"""
Prepare spectroscopy data for visualization in the SpectraMosaic tool.

Usage
-----

  And output root folder must be specified in all cases:

    -o [foldername] : Root folder for output data


  Input data may be specified either as a folder to be scanned for input data (for ONE session):

    -i [foldername] : Folder to scan for input data
    P file must also be clearly specified still in case of using root input directory like this


  ..OR as a series of structural and spectrography images, like this:

    [structural1] [pfile1] [pfile2] ... 

  Structural images *must* be original dicom images. Converted data (eg, niftis) lose some necessary orientation headers.

  For example, for Linux users...

    ./spectramosaic_prep.py -o /scratch/spectramosaic /data/spectra/alex/5809/2 /data/spectra/alex/P*7

   And for Mac users...

    python spectramosaic_prep.py -o /scratch/spectramosaic /data/spectra/alex/5809/2 /data/spectra/alex/P*7 


  FUTURE: This may be extended to allow processing of multi-session/longitudinal data from a single subject, in which case the usage would most likely follow the pattern:

    [struct_sess1] [pfile_sess1_1] [pfile_sess2_2] ... [struct_sess2] [pfile_sess2_1] [pfile_sess2_2]



Output
------

  Output data will be conformant to SpectraMosaic project's preferred input structure, as specified at <https://git.app.uib.no/Laura.Garrison/spectramosaic/blob/master/README.md>, ie:

    - root
	- patient_xxx
	    - voxel_xxx
	    - voxel_xxx
	- patient_xxx
	    - voxel_xxx
	    - voxel_xxx
	- ___header_info.csv

..._header_info.csv
-------------------

  This file contains data for fall subjects/voxels.

  Voxel ID;Patient;State;Time;Gender;Age;TE;location
  voxel_xxx;patient_xxx;something;something;something;something;something;somewhere

Per-voxel files
---------------

  voxel_xxx_mask_spectramosaic_ax.png
  voxel_xxx_mask_spectramosaic_sag.png
  voxel_xxx_mask_spectramosaic_cor.png
  voxel_xxx.7
  voxel_xxx.7.coo-output.csv

  Spectral acquisition and model fit data should be in .csv format, organized into 4 columns:

      column 1: ppm, x-axis coordinates
      column 2: raw data output, y-axis coordinates
      column 3: model fit, y-axis coordinates
      column 4: baseline, y-axis coordinates

"""

import sys;
import os;
from collections import defaultdict;
import shutil;
import subprocess;
from pfile import *;
from mergemasks import *;

# Various little helper functions {{{
def is_uptodate(fns,refs):
  """ Returns true iff all fns exist and are newer than any existing refs"""
  # make sure fns and refs are both lists...
  if isinstance(fns,basestring):
    fns=[fns];
  if isinstance(refs,basestring):
    refs=[refs];

  for fn in fns:
    for ref in refs:
      ok=os.path.exists(fn) and ((not os.path.exists(ref)) or (os.path.getctime(fn) > os.path.getctime(ref)));
      if not ok:
        return False;

  return True;

def which(cmd):
  w=None;
  try:
    w=shutil.which(cmd);
  except AttributeError:
    from subprocess import Popen, PIPE
    p = subprocess.Popen(['which', cmd], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    output, err = p.communicate();
    if p.returncode==0:
      w=output.strip();
  if w is not None and len(w)==0:
    w=None;
  return w;

def sanitize_string(string,spaces_ok=True):
  if spaces_ok:
    return re.sub('[^A-Za-z0-9 ]+','.', string);
  else:
    return re.sub('[^A-Za-z0-9]+','.', string);

# }}}

def run_run_makemask(*args): # {{{
  """ Invoke the matlab-based mask generation script; through matlab if possible, or via pre-compiled version """

  where_am_i=os.path.dirname(os.path.realpath(__file__));

  run_makemask=os.path.join(where_am_i,'build','distrib','run_makemask.sh');

  if not is_uptodate(run_makemask,os.path.join(where_am_i,'gemask.m')):
    print('BEWARE! The pre-compiled version of gemask.m is not up-to-date!');

  args=list(args);
  args.append('native_mask');

  # Option One: spawn matlab, if available {{{

  matlab=which('matlab');

  if matlab is not None and os.path.exists(matlab):
    # Looks like we have a local instance of matlab, so we use that for convenience
    env_noX=os.environ.copy();
    env_noX['DISPLAY']='';

    cmds=[ 
      "addpath('%s');" % (where_am_i,),
      "gemask('%s');"  % ("','".join(args),),
      "exit;"
      ];

    p = subprocess.Popen(['matlab','-nodisplay','-nosplash','-nojvm'], stdout=subprocess.PIPE, stdin=subprocess.PIPE, stderr=subprocess.PIPE, env=env_noX); #cwd=self.uniquedir)
    output,err=p.communicate('\n'.join(cmds));
    print output;
    print err;

  #}}}
  else:
    # Fallback option: try to find a meaningful runtime and use the precompiled version. Rather more platform-specific. {{{
    
    MCR_folder_candidates=['/usr/local/MATLAB/MATLAB_Compiler_Runtime/v81','/opt/MATLAB/R2013a'];
    MCR_folder=None;
    for f in MCR_folder_candidates:
      if os.path.exists(f):
        MCR_folder=f;
        break;
    if MCR_folder is None:
      print 'This program requires matlab compiler runtime v8.1 (Matlab R2013a). Please install this version, from https://se.mathworks.com/products/compiler/matlab-runtime.html';
      raise Exception('Cannot find matlab compiler runtime.');
    else:
      # FIXME need to check for compatible architecture, rather than just blindly assuming we're running on linux.
      bits=[run_makemask,MCR_folder]+list(args)+['native_mask'];
      subprocess.call(bits);
      print bits;

    print 'matlab command: %s; runtime: %s' % (matlab, MCR_folder);
    # }}}

# }}}

def update_header_info(output_root, pfiles): # {{{
  """ Update the ..._header_info.csv file to incorporate entries from additional pfiles 

  Existing rows are retained, or updated if they match the input.

  """

  import csv;
  output_file_name=os.path.join(output_root,'something_header_info.csv');

  horder=['Voxel ID','Patient','State','Time','Gender','Age','TE','location'];

  all_rows=[];

  if os.path.exists(output_file_name):
    with open(output_file_name,'rb') as csvfile:
      hreader=csv.DictReader(csvfile,delimiter=';');
      for row in hreader:
        all_rows.append(row);


  for pfile in pfiles:
    row={
      'Voxel ID' : pfile.shortname,
      'Patient'  : sanitize_string(pfile.patient_name,spaces_ok=False), # needs to EXACTLY match output folder name
      'State'    : pfile.series_protocol,
      'Time'     : pfile.exam_datetime,
      'Gender'   : pfile.patient_sex,
      'Age'      : pfile.patient_age,
      'TE'       : pfile.te/1000,
      'location' : pfile.series_description
    };
    all_rows.append(row);

  # filter to keep only the most recent
  row_dict={};
  for row in all_rows:
    key='P:'+row['Patient']+',V:'+row['Voxel ID'];
    row_dict[key]=row;

  # write out, sorted by patient/ID
  with open(output_file_name,'wb') as csvfile:
    hwriter=csv.DictWriter(csvfile,horder,delimiter=';');
    hwriter.writeheader();
    for key in sorted(row_dict):
      hwriter.writerow(row_dict[key]);
  print output_file_name;
# }}}

def quick_quantify(P,output_folder): # {{{
  """ Quick-and-dirty spectral quantification. Might be okay for short TE, humanoid, brain, proton, PRESS data. This needs improvement. """
  tarquin=which('tarquin');

  basefn=os.path.join(output_folder,P.shortname);
  P.describe()

  if tarquin is not None:
    is_mega=P.nechoes==2;

    fancy=False;

    if not fancy:
      if is_mega:
        cmd=[tarquin, '--format','ge','--int_basis','megapress_gaba','--pul_seq','mega_press','--dyn_av','subtract']
      else:
        cmd=[tarquin, '--format','ge','--int_basis','1h_brain','--pul_seq','press']

    else:
      cmd=[tarquin,
        '--format','ge',
        '--ge_wframes','8',
        '--start_pnt','10',
        '--w_att','0.64',
        #'--inv_even_pairs','true'
        ];

      if is_mega:
        cmd=cmd+[
        '--pul_seq','mega_press',
        '--start_pnt','10',
        '--dyn_av','subtract',
        '--ref_signals','1h_naa',
        '--dyn_freq_corr','true',
        '--water_eddy','true',
        '--dref_signals','1h_h2o',
        '--pdfc','true',
        '--int_basis','megapress_gaba'
        ]

      else:

        cmd=cmd+[
        '--pul_seq','press',
        '--dyn_av','even',
        '--int_basis','1h_brain'
        ]

    cmd=cmd+[
      '--output_txt',basefn+'.txt',
      '--output_csv',basefn+'.csv',
      '--write_post',basefn+'.dpt',
      '--output_pdf',basefn+'.pdf',
      '--output_fit',basefn+'.fit.csv',
      #'--output_spec',basefn+'.spec.csv',
      #'--output_spec_m',basefn+'.spec_m.csv',
      # '--av_list',avlistfn,
      '--input',P.fullpath
    ]

    if not os.path.exists(basefn+'.fit.csv'):
      subprocess.call(cmd);

    convert=which('convert');

    if os.path.exists(basefn+'.pdf') and convert is not None:
      subprocess.call([convert,'-density','300',basefn+'.pdf','-trim','+repage','-resize','800x600','-background','#FFFFFF','-flatten',basefn+'.png']);


  #lcmodel=which('lcmodel');

  # }}}

def spectramosaic_prep(output_root, struct_folder, pfile_names): # {{{
  """Do the things."""

  if not os.path.exists(struct_folder):
    raise IOError('Specified structural folder does not exist: %s' % (struct_folder,));

  if not os.path.isdir(struct_folder):
    raise IOError('Specified structural folder is not actually a folder: %s' % (struct_folder,));

  # create a working area, separate but related to the output_root
  scratch_folder=os.path.join(output_root,'')[:-1]+'.working';
  print os.path.join(output_root,'')[:-1];
  print scratch_folder;
  if not os.path.exists(scratch_folder):
    os.makedirs(scratch_folder);

  pfiles=[];
  for fn in pfile_names:
    P=pfile.from_file(fn);
    pfiles.append(P);
    print sanitize_string(P.series_description);
    subject_subfolder=sanitize_string(P.patient_name,spaces_ok=False);
    spect_subfolder=P.shortname;

    voxel_folder=os.path.join(output_root,subject_subfolder,spect_subfolder);
    if not os.path.isdir(voxel_folder):
      os.makedirs(voxel_folder);

    # working folder separated by session, but not by voxel (saves having to re-register structural to template for each voxel)
    voxel_working_folder=os.path.join(scratch_folder,subject_subfolder);
    if not os.path.isdir(voxel_working_folder):
      os.makedirs(voxel_working_folder);

    # populate with dummy data, for now:

    import shutil;
    import numpy as np;

    if False:
      # is this thing actually used? Nope.
      from PIL import Image;
      i=Image.open('./extra/test_data/subj1.png');
      r=i.rotate(180);
      r.save(os.path.join(voxel_folder,'%s.7.png' % (P.shortname)));

    expected_mask_nii=os.path.join(voxel_working_folder,'%s_mask.nii' % (P.shortname));
    expected_volume_nii=os.path.join(voxel_working_folder,'volume.nii');


    if is_uptodate([expected_volume_nii,expected_mask_nii],[fn,struct_folder]):
      print 'Mask nifti %s is up-to-date.' % (expected_mask_nii)
    else:
      print 'Mask nifti %s required.' % (expected_mask_nii)
      run_run_makemask(fn,struct_folder,'output_folder',voxel_working_folder);

    expected_mask_images={};
    for orientation in ['sag','ax','cor']:
      expected_mask_images[os.path.join(voxel_working_folder,'%s_mask_spectramosaic_%s.png' % (P.shortname,orientation))]=os.path.join(voxel_folder,'%s_mask_spectramosaic_%s.png' % (P.shortname,orientation));

    if is_uptodate(expected_mask_images.keys(),[expected_mask_nii,expected_volume_nii]):
      print 'Mask images are up-to-date.';
    else:
      print 'Mask images are required.';
      print ", ".join(expected_mask_images.keys());
      merge_masks(expected_volume_nii,expected_mask_nii,mode='spectramosaic');

    for expected_mask_image in expected_mask_images:
      if os.path.exists(expected_mask_image):
        print '%s => %s' % (expected_mask_image, expected_mask_images[expected_mask_image]);
        shutil.copyfile(expected_mask_image, expected_mask_images[expected_mask_image]);
      else:
        shutil.copyfile('./extra/test_data/subj1.png',expected_mask_images[expected_mask_image]);

    quick_quantify(P,voxel_working_folder);

    tarquin_output=os.path.join(voxel_working_folder,'%s.fit.csv' % (P.shortname));

    if os.path.exists(tarquin_output):
      imported_data=np.loadtxt(tarquin_output,skiprows=2,delimiter=',');
      filtered_data=imported_data[:,0:4];
      filtered_data=filtered_data[np.logical_and(filtered_data[:,0]<5,filtered_data[:,0]>-1),:];
      print filtered_data;
    else:
      print 'WARNING: Generating dummy output.';
      ppm=np.linspace(4.2,0.2,1000);

      sh=10*np.random.rand(4);

      raw     =100*np.sin(ppm+sh[1])+50*np.cos(3*ppm+sh[0])+20*np.sin(7*ppm+sh[2])+10*np.random.ranf(ppm.size);
      fit     =  5*np.sin(ppm+sh[1])+45*np.cos(3*ppm+sh[0]);
      baseline= 95*np.sin(ppm+sh[1])+ 5*np.cos(3*ppm+sh[0]);

      filtered_data=np.column_stack((ppm,raw,fit,baseline));

    np.savetxt(os.path.join(voxel_folder,'%s.csv' % (P.shortname)),filtered_data,fmt='%.5e',delimiter=',');




      #column 1: ppm, x-axis coordinates
      #column 2: raw data output, y-axis coordinates
      #column 3: model fit, y-axis coordinates
      #column 4: baseline, y-axis coordinates




  update_header_info(output_root,pfiles);

# }}}

if __name__=='__main__': # command-line operation? {{{

  state=None;
  output_root=None;
  this_struct=None;
  struct_spec=defaultdict(list);

  for k in sys.argv[1:]:
    print k;
    if state is None:
      if k=='-o':
        state='-o';
      elif os.path.isdir(k):
        this_struct=k;
      elif os.path.isfile(k):
        if this_struct is None:
          raise ValueError('You must specify a structural dicom folder, before specifying individual spectra (parameter: %s).' % (k,));
        else:
          struct_spec[this_struct].append(k);
      else:
        raise ValueError('What is this? : %s' % (k));
    elif state=='-o':
      if not os.path.isdir(k):
        try:
          os.makedirs(k);
        except OSError as exc:
          print '-o option expects a valid path, which %s is not' % (k,);
          raise;
      output_root=k;
      state=None;
    else:
      raise Exception('However did I get here?');


  if output_root is None:
    raise ValueError('You must specify an output root, like this: -o /path/to/root');
  elif len(struct_spec)==0:
    raise ValueError('This would go better if you specified some data to process.');

  print 'Ready to go, like this:'
  print '';
  print ' / %s' % (output_root,);
  for sub in struct_spec:
    print ' |-- %s' % (sub,)
    for spec in struct_spec[sub]:
      print ' |     |-- %s' % (spec)

  for sub in struct_spec:
    spectramosaic_prep(output_root, sub, struct_spec[sub]);

# }}}
