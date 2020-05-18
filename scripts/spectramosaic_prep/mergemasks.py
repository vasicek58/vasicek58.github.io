#!/usr/bin/python

import os;
import nibabel as nib;
import re;
import numpy as np;
import math as m;
import sys;

from PIL import Image, ImageDraw, ImageFont;  # pip install Pillow
import cv2; # pip install opencv-python
import scipy.ndimage; # pip install scipy


def merge_folder(p):
  grouped={'all':{'volume':None,'masks':[]}};

  for root, subFolders, files in os.walk(p):
    print(root);
    for f in files:
      is_mask=re.match('^P.*mask.nii$',f);
      is_ss_mask=re.match('^mni_P.*mask.nii$',f);
      is_volume=(not is_mask) and re.match('^volume.nii$',f);
      is_segmentation=(not (is_mask or is_volume)) and re.match('c[1-3]volume.nii$',f);
      if (is_mask or is_volume or is_segmentation) and not root in grouped:
        grouped[root]={'masks':[],'volume':None};
      if is_ss_mask:
        grouped['all']['masks'].append(os.path.join(root,f));
      elif is_mask:
        grouped[root]['masks'].append(f);
      elif is_volume:
        grouped[root]['volume']=f;
      elif is_segmentation:
        if not 'tissuemask' in grouped[root]:
          grouped[root]['tissuemask']={};
        grouped[root]['tissuemask'][f]=f;

  for root in grouped:
    structural=None;
    masks=[];
    tissuemasks={};
    if (root=='all'):
      structural=None;
      output_folder=p;
      for mask in grouped[root]['masks']:
        masks.append(os.path.join(p,mask));
        print(mask);
    else:
      if (root==p):
        p='.';

      output_folder=os.path.join(p,root);

      structural=os.path.join(p,root,grouped[root]['volume']);

      if 'tissuemasks' in grouped[root]:
        for tc in grouped[root]['tissuemask']:
          tissuemasks[tc]=os.path.join(p,root,grouped[root]['tissuemask'][tc]);

      for mask in grouped[root]['masks']:
        masks.append(os.path.join(p,root,mask));
        print(mask);
    
    print("merge_masks ============")
    print(structural)
    print(masks)
    print(tissuemasks);
    merge_masks(structural,masks,tissuemask=tissuemasks,output_folder=output_folder);

def merge_masks(structural, masks, ofn_base=None, tissuemask=None, output_folder=None, mode=None):
  dbg=False;

  if structural is None:
    structural='/usr/share/data/fsl-mni152-templates/MNI152_T1_1mm.nii.gz';
    if len(masks)==0:
      print('Nothing to do.');
      return None;
    if output_folder is None:
      output_folder=os.getcwd();
  else:
    if output_folder is None:
      output_folder=os.path.dirname(structural);
  if dbg:
    print(structural)

  zoomfactor=4;

  base=nib.load(structural);
  base_data=np.array(base.get_data());
  if dbg:
    print(base_data.shape);

  mask_merged=np.zeros(base_data.shape);

  if isinstance(masks,basestring):
    masks=[masks]; # only one mask specified, as a string.

  single=len(masks)==1;

  for mask in masks:
    if dbg:
      print(mask);
    mim=nib.load(mask);
    mask_data=np.array(mim.get_data());
    mask_merged=mask_merged+mask_data;
    if dbg:
      print(mask_data.shape);

  if dbg:
    print(base)
    print(base.get_affine())
    print(base.get_header())

  # mask_img=nib.Nifti1Image((100.0*mask_merged.astype('float')/(255.0*len(masks))),base.get_affine(),base.get_header())
  # mask_scaled=np.clip(mask_merged.astype(float)/(2.55*len(masks)),0,1);
  mask_scaled=np.clip(mask_merged.astype(float)/(2.55*len(masks)),0,100).astype('uint8');
  nh=base.get_header();
  nh['cal_min']=5;
  nh['cal_max']=100;

  if dbg:
    print(nh);

  mask_img=nib.Nifti1Image(mask_scaled,base.get_affine(),nh)
  if ofn_base is not None:
    nib.save(mask_img,'%s_prob.nii' % ofn_base);
  else:
    nib.save(mask_img,os.path.join(output_folder,'merged_prob.nii'));

  com=scipy.ndimage.center_of_mass(mask_merged);
  
  if dbg:
    print(com);
    print(mask_merged.shape)

  if abs(com[0]-(mask_merged.shape[0]/2))<3: # midline! shift it a bit to get a more interesting slice
    if dbg:
      print('COM shift [0]');
    com=[x for x in com]; com[0]-=7; 


  datasets={'base':base_data,'mask':mask_merged};
  slices={};
  slices_normalised={}
  if tissuemask is not None and len(tissuemask)==3:
    for mc in ['c1','c2','c3']:
      tmfn=tissuemask['%svolume.nii' % (mc,)];
      tm=nib.load(tmfn);
      tm_data=np.array(tm.get_data());
      datasets[mc]=tm_data;
  axes=[0,1,2];
  axkey=['sag','cor','ax'];
  for ax in axes:
    slicenum=int(np.floor(com[ax]));
    for ds in datasets:
      if dbg:
        print(ds);
        print(slicenum)
      data=datasets[ds];
      if ax==0:
        slices[ds]=data[slicenum,:,:];
      elif ax==1:
        slices[ds]=data[:,slicenum,:];
      elif ax==2:
        slices[ds]=data[:,:,slicenum];

    for ds in datasets:
      if ds=='image':
        slices[ds]=scipy.ndimage.zoom(slices[ds], zoomfactor, order=2) 
      else:
        slices[ds]=scipy.ndimage.zoom(slices[ds], zoomfactor, order=1) # higher-order interpolations introduce edge artifacts which give peculiar contours.
      slices_normalised[ds]=slices[ds]*255.0/np.max(slices[ds].flat);

    image_slice=slices['base'];
    mask_slice=slices['mask'];

    mask_normalised=mask_slice*255.0/np.max(mask_slice.flat);
    # image_normalised=image_slice*255.0/np.max(image_slice.flat);

# http://opencvpython.blogspot.no/2013/03/histograms-2-histogram-equalization.html
    bg=((255.*image_slice)/max(image_slice.flat)) #.astype('uint8');
    hist,bins = np.histogram(bg.flatten(),256,[20,256])
    cdf = hist.cumsum()
    cdf_normalized = cdf *hist.max()/ cdf.max() # this line not necessary.
    cdf_m = np.ma.masked_equal(cdf,0)
    cdf_m = (cdf_m - cdf_m.min())*225/(cdf_m.max()-cdf_m.min())
    cdf = np.ma.filled(cdf_m,0).astype('uint8')
    image_normalised = cdf[bg.astype('uint8')]


    mask_ui=mask_normalised.astype('uint8');

    ret,thresh=cv2.threshold(mask_ui,20,255,0);
    contours,hierarchy = cv2.findContours(thresh, 1, 2)

    # percentile contours {{{

    if mode is None:
      modes=['spectramosaic', 'percentiles','solidfill','solidfill_nopercentile','box_only','gradfill','c1','c2','c3'];
    else:
      modes=[mode];

    for mode in modes:

      do_percentiles=True;
      do_rectangle=True;

      use_mask=mask_normalised;
      rec_linewidth=zoomfactor;

      downweight=None;
      if mode=='spectramosaic':
        bc=[255,0,255];
        do_rectangle=True;
        do_percentiles=False;
        rec_linewidth=5;
        do_percentiles=False;
        fill=[x/3 for x in bc];
        a=50;b=5;c=0.1;d=0.9;
        downweight=d-c*np.concatenate((np.zeros((a)), np.linspace(0,1,256-(a+b)), np.ones((b))));
      if mode=='percentiles': # 0
        bc=[255,128,0];
        fill=[0,0,0];
      elif mode in ['solidfill']: # 1
        bc=[255,0,255];
        fill=[x/5 for x in bc];
      elif mode=='solidfill_nopercentile':
        bc=[255,128,0];
        rec_linewidth=7;
        do_percentiles=False;
        fill=[x/3 for x in bc];
        a=50;b=5;c=0.1;d=0.9;
        downweight=d-c*np.concatenate((np.zeros((a)), np.linspace(0,1,256-(a+b)), np.ones((b))));
      elif mode in ['c1','c2','c3']: # tissue class segmentation
        if not mode in slices_normalised:
          continue; # skip tissue class seg.
        bc=[255,128,0];
        if mode=='c1':
          fill=[0,0,255];
        elif mode=='c2':
          fill=[0,255,0];
        elif mode=='c3':
          fill=[255,0,0];
        use_mask=slices_normalised[mode]*mask_normalised/255.;
        do_percentiles=False;
        a=50;b=5;c=0.75;d=0.9;
        downweight=d-c*np.concatenate((np.zeros((a)), np.linspace(0,1,256-(a+b)), np.ones((b))));
      use_mask_ui=use_mask.astype('uint8');

      if mode=='box_only':
        bc=[255,128,0];
        fill=[0,0,0];
        do_percentiles=False;
        rec_linewidth=(zoomfactor*2)-1;


      if mode=='gradfill':
        do_rectangle=False;
        gscale=0.5;
        grad_r=gscale*np.concatenate(( np.zeros((5)), np.linspace(0,255,10), 255*np.ones((118)),         np.linspace(255,0,50),    np.zeros((73)) ))
        grad_g=gscale*np.concatenate(( np.zeros((5)), np.zeros((10))       , np.linspace(0,128,118), np.linspace(128,154,50), 154*np.ones((73)) ))
        grad_b=gscale*np.concatenate(( np.zeros((5)), np.zeros((10))       , np.zeros((118)),        np.linspace(0,128,50),   np.linspace(128,0,73) ))
        a=50;b=5;
        downweight=1-0.3*np.concatenate((np.zeros((a)), np.linspace(0,1,256-(a+b)), np.ones((b))));


        r=np.clip(downweight[mask_ui]*image_normalised+grad_r[mask_ui],0,255);
        g=np.clip(downweight[mask_ui]*image_normalised+grad_g[mask_ui],0,255);
        b=np.clip(downweight[mask_ui]*image_normalised+grad_b[mask_ui],0,255);

      else:
        if downweight is None:
          downweight=np.array([1.]*256);
        r=np.clip(downweight[use_mask_ui]*image_normalised+fill[0]*use_mask/255.0,0,255);
        g=np.clip(downweight[use_mask_ui]*image_normalised+fill[1]*use_mask/255.0,0,255);
        b=np.clip(downweight[use_mask_ui]*image_normalised+fill[2]*use_mask/255.0,0,255);

      if do_percentiles: # highlight percentiles {{{
        print('%s : including percentiles' % (mode,))

        contour_colouring={0.05:[1,0,0,1],.5:[1,.5,0,2],.95:[0,.6,0,3]}

        for th in contour_colouring : # {{{

          colouring=[int(255*x) for x in contour_colouring[th]];
          lw=contour_colouring[th][3];

          ascale=255.0;

          ret,threshC = cv2.threshold(mask_ui,int(th*ascale),255,0)

          print(np.max(mask_ui))
          print(th*ascale)
          print(ascale)

# also has offset!
          contours2,hierarchy2=cv2.findContours(threshC,method=cv2.CHAIN_APPROX_TC89_KCOS,mode=cv2.RETR_EXTERNAL);

          if len(contours2)==0:
            continue;

# http://stackoverflow.com/questions/8461612/using-hierarchy-in-findcontours-in-opencv
          print('hierarchy:')
          print(hierarchy2);
          # hierarchy2=[x for x in hierarchy2.flat]; # this really shouldn't be needed...
          hierarchy2=hierarchy2[0];

# cv2.CV_RETR_EXTERNAL cv2.RETR_LIST, cv2.RETR_CCOMP
# HAIN_APPROX_SIMPLE, CHAIN_APPROX_TC89_L1,CV_CHAIN_APPROX_TC89_KCOS
          print('...')
          for h in hierarchy2:
            print(h)
          print('...')
          for ci in range(0,len(contours2)):
            h=hierarchy2[ci];
            print(h)
            if h[3]==-1 and colouring is not None: # outer contour, explicit colouring
                cv2.drawContours(r,contours2,ci,colouring[0],lw);
                cv2.drawContours(g,contours2,ci,colouring[1],lw);
                cv2.drawContours(b,contours2,ci,colouring[2],lw);
            else:
              if h[3]==-1:
                cv2.drawContours(g,contours2,ci,0,lw);
                print('outer')
              else:
                cv2.drawContours(g,contours2,ci,255,lw);
                print('inner')
              if cv2.arcLength(contours2[ci],True)>50:
                cv2.drawContours(b,contours2,ci,0,lw);
              else:
                cv2.drawContours(b,contours2,ci,255,lw);

          if colouring is None:
            cv2.drawContours(r,contours2,-1,255,2,lw);

        # }}} 

      #  }}}

      r=Image.fromarray(r.astype('uint8'));
      g=Image.fromarray(g.astype('uint8'));
      b=Image.fromarray(b.astype('uint8'));

      if do_rectangle: # {{{
        print('%s : including "rectangular" voxel outline' % (mode,))
        # we wish to draw nice, non-blocky boxes around these things. use cv2 to find contours and generate bounding rectangles for plotting:
        for cn in contours:  
          print('Rectangle coords:')
          rect=cv2.minAreaRect(cn);
          print(rect)
          rect_fn=('%s%s_%s.csv' % (ofn_base,mode,axkey[ax],));
          print('Saving to %s' % (rect_fn,))
          with open(rect_fn,'w') as rf:
            rf.write('%.2f;%.2f;%.2f;%.2f;%.2f' % (rect[0][0],rect[0][1],rect[1][0],rect[1][1],rect[2]));
          ox=rect[0][0]
          oy=rect[0][1]
          shrinkage=(zoomfactor+rec_linewidth)/2
          lx=rect[1][0]-shrinkage
          ly=rect[1][1]-shrinkage
          rot=-rect[2]*2.*m.pi/360;
          rm=np.array([[m.cos(rot),-m.sin(rot)],[m.sin(rot),m.cos(rot)]])


          x1=0-lx/2; x2=0+lx/2; y1=0-ly/2; y2=0+ly/2;
          box=np.array([[x1,y1],[x1,y2],[x2,y2],[x2,y1],[x1,y1]]);
          rotbox=box.dot(rm);
          shiftbox=rotbox+[ox,oy]
          print(rm)
          print(rotbox)
          print(shiftbox)
          box=shiftbox;

          #box = cv2.boxPoints(rect)
          pts=tuple(map(tuple, box))

          draw=ImageDraw.Draw(r);
          draw.line(pts, fill=bc[0], width=rec_linewidth)

          draw=ImageDraw.Draw(g);
          draw.line(pts, fill=bc[1], width=rec_linewidth)

          draw=ImageDraw.Draw(b);
          draw.line(pts, fill=bc[2], width=rec_linewidth)
      # }}}

      cim=Image.merge('RGB',(r,g,b));
      cim=cim.rotate(90,expand=True);
      
      if ofn_base is None:
        if single:
          prefix=re.sub('(\.7|_mask\.nii)$','',os.path.basename(masks[0]))+'_mask_';
          print prefix;
        else:
          prefix='mask_';
        ofn_base=os.path.join(output_folder,prefix);

      ofn='%s%s_%s.png' % (ofn_base,mode,axkey[ax],);

      print(ofn);
      cim.save(ofn);

if __name__ == "__main__":
  if len(sys.argv)>1:
    for p in sys.argv[1:]:
      merge_folder(p);
  else:
    print('Nothing to do; please nominate folder(s) to process on the command line.');
