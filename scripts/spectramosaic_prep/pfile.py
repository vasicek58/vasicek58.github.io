#!/usr/bin/python

import re;
import os.path;
import sys;
import time;
from collections import OrderedDict;

class pfile(object):
  """
  Rudimentary GE P-file header reading
  """

  def __init__(self, header):
    self.header=header;
    print header;

  def __getattribute__(self,name):
    x=['header'];
    if not name in x and name in self.header:
      return self.header[name];
    else:
      return super(pfile,self).__getattribute__(name);

  def describe(self):
    for k in self.header:
      print "%-20s : %s" % (k,str(self.header[k]))

  @staticmethod
  def read_header(fn):
    """
    EXPERIMENTAL function to extract a handful of key header elements from some familiar versions of the p-file.
    """
    from array import array;
    import struct;

    dbg=False;

    itypes={'h','i','l'}
    intN={}
    for t in itypes:
      x=array(t);
      intN[x.itemsize]=t;

    with open(fn,'rb') as f:
      chunk=f.read(4);
      if dbg:
        print chunk;
      endian='>'; # first try big-endian
      version=struct.unpack('>f', chunk)[0]
      if version==7.0:
        hdr_size=39984 # LX
      elif version==8.0:
        hdr_size=60464  # Cardiac / MGD
      elif version>5.0 and version<6.0:
        hdr_size=39940 # Signa 5.5
      else:
        endian='<'; # it's little endian
        version=struct.unpack('<f', chunk)[0]
        if version==9.0: # 11.0 product release
          hdr_size=61464;
        elif version==11.0:
          hdr_size=66072;
        elif version>11.0 and version<100: # 14.0 and later
          # 4-byte signed... l or i?
          larr=array(intN[4]) 
          f.seek(1468);
          hdr_size=struct.unpack('<i', chunk)[0]
          f.seek(1468);
          larr.fromfile(f,10);
          hdr_sizes=list(larr);
          #chunk=f.read(4*10);
        else:
          print "Version %d unknown" % (version);
          version=-1;
      print "Version %d Header Size %d" % (version,hdr_size);
      ver=int(version);

      # ARC 20161012: ignoring endianness for now!! FIXME


      f.seek(0);

      #chunk=f.read(2*102);
      #dat=struct.unpack('%sh' % (endian,), chunk);
      #print dat;
      iarr=array('h');
      iarr.fromfile(f,102);
      header_sizes=list(iarr);
      if dbg:
        print len(iarr);
        print header_sizes;
      #iarr.byteswap();
      x={n:"%d" % (iarr[n],) for n in range(0,100)};
      if dbg:
        print x;

      f.seek(0);
      rarr=array('f');
      rarr.fromfile(f,200);
      x={n:"%-5.2f" % (rarr[n],) for n in range(0,110)};
      if dbg:
        print x;


        print iarr[34];
        print iarr[34];
        print iarr[34];


      # all indices are 1 less than matlab implementation!
      attribs=OrderedDict();
      attrib_ref={
        "npasses":32,
        "nslices":34,
        "nechoes":35,
        "navs":36,
        "nframes":37,
        "point_size":41,
        "MRS_struct.p.npoints":51,
        "MRS_struct.p.nrows":52,
        "rc_xres":53,
        "rc_yres":54,
        "start_recv":100,
        "stop_recv":101
      }




      attribs_by_version={
        11: { "ras_center":  24, "ras_normal": 101, "readsize":104 },
        14: { "ras_center":  40, "ras_normal": 117, "readsize":120 },
        15: { "ras_center":  40, "ras_normal": 117, "readsize":120 },
        16: { "ras_center":  52, "ras_normal": 129, "ras_topleft": 132, "ras_topright": 135, "ras_bottomright": 138, "readsize":140 }, # this one hasn't been tested particularly well.
        24: { "ras_center": 174, "ras_normal": 177, "ras_topleft": 180, "ras_topright": 183, "ras_bottomright": 186,  "readsize":200 },
      }

      ofs_mrimgdata_hdr=hdr_sizes[9]
      ofs_exam_data=hdr_sizes[7];
      ofs_series_data=hdr_sizes[8];

      strings_by_version={
        11: { "patient_name": (ofs_exam_data+449, 25), "series_descriptioin": (ofs_series_data+298,35), "series_protocol": (ofs_series_data+384, 35) },
        15: { "patient_name": (ofs_exam_data+774, 25), "series_description":  (ofs_series_data+506,35), "series_protocol": (ofs_series_data+592, 35) },
        16: { "patient_name": (ofs_exam_data+774, 25), "series_description":  (ofs_series_data+506,35), "series_protocol": (ofs_series_data+592, 35) },
        24: { "patient_name": (ofs_exam_data+1524,25), "series_description":  (ofs_series_data+982,35), "series_protocol": (ofs_series_data+1068,35) }
      }

      if ver in strings_by_version:
        for k in strings_by_version[ver]:
          f.seek(strings_by_version[ver][k][0]);
          b=f.read(strings_by_version[ver][k][1]).split('\x00')[0];
          attribs[k]=b;
      else:
        print 'Unfamiliar version, %f' % (ver,)

      ints_by_version={
        11: { "te":          (ofs_mrimgdata_hdr+720,  16), "patient_age": (ofs_exam_data+213,     16),"patient_sex": (ofs_exam_data+217,     16), "exam_datetime": (ofs_exam_data+220,     32) }, # UNTESTED!
        15: { "te":          (ofs_mrimgdata_hdr+720,  32), "patient_age": (ofs_exam_data+292,     16),"patient_sex": (ofs_exam_data+296,     16), "exam_datetime": (ofs_exam_data+220,     32) },
        16: { "te":          (ofs_mrimgdata_hdr+768, -32), "patient_age": (ofs_exam_data+292,     16),"patient_sex": (ofs_exam_data+296,     16), "exam_datetime": (ofs_exam_data+220,     32) }, # UNTESTED
        24: { "te":          (ofs_mrimgdata_hdr+1064, 32), "patient_age": (ofs_exam_data+292+424, 16),"patient_sex": (ofs_exam_data+296+424, 16), "exam_datetime": (ofs_exam_data+220+364, 32) }, # UNTESTED

      }

      # generate a map of size-in-bytes to array typecode (spec at https://docs.python.org/3/library/array.html defines only minimum).
      # there's probably a waaay better way of doing this.
      typecodes={};
      for k in ['b','h','i','l']: # ,'f','d']:
        x=array(k);
        typecodes[-8*x.itemsize]=k;         #   signed variant is lowercase
        typecodes[ 8*x.itemsize]=k.upper();  # unsigned variant is uppercase

      if dbg:
        print typecodes;

      if ver in ints_by_version:
        for k in ints_by_version[ver]:
          f.seek(ints_by_version[ver][k][0]);
          iab=array(typecodes[ints_by_version[ver][k][1]]);
          iab.fromfile(f,100);
          if dbg:
            print k;
            if iab.itemsize>2:
              print 'offset 2-bytes:';
              f.seek(ints_by_version[ver][k][0]+2);
              x=array(typecodes[ints_by_version[ver][k][1]]);
              x.fromfile(f,100);
              print x;
              print 'not offset:'
            print iab;
          attribs[k]=iab[0];
      else:
        print 'Unfamiliar version, %f' % (ver,)
          # print string.from_bytes(b)

          #carr=array('c');
          #carr.fromfile(f,strings_by_version[ver][k][1]);
          #print carr;

      if 'exam_datetime' in attribs:
        attribs['exam_datetime']=time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(attribs['exam_datetime']))

      if 'patient_sex' in attribs:
        if attribs['patient_sex']==2:
          attribs['patient_sex']='F';
        elif attribs['patient_sex']==1:
          attribs['patient_sex']='M';

      print '----'
            # print string.from_bytes(b)

            #carr=array('c');
            #carr.fromfile(f,strings_by_version[ver][k][1]);
            #print carr;

      fattrib_ref={
        "ras_center_r": attribs_by_version[ver]["ras_center"],
        "ras_normal_r": attribs_by_version[ver]["ras_normal"]
      }
      fattrib_ref["ras_center_a"]=fattrib_ref["ras_center_r"]+1;
      fattrib_ref["ras_center_s"]=fattrib_ref["ras_center_r"]+2;
      fattrib_ref["ras_normal_a"]=fattrib_ref["ras_normal_r"]+1;
      fattrib_ref["ras_normal_s"]=fattrib_ref["ras_normal_r"]+2;

      f.seek(368);
      rarr=array('f');
      rarr.fromfile(f,9);
      if dbg:
        print rarr;
      attribs["ras_size"]=rarr[3:6]
      if dbg:
        print attribs["ras_size"]

      arr=array('f');
      f.seek(ofs_mrimgdata_hdr);
      rarr.fromfile(f,attribs_by_version[ver]["readsize"]);

      for attrib in attrib_ref:
        attribs[attrib]=iarr[attrib_ref[attrib]];
        if dbg:
          print "i %-20s (%03d) : %d" % (attrib,attrib_ref[attrib],attribs[attrib]);
      attribs["nreceivers"]=1+attribs["stop_recv"]-attribs["start_recv"];

      for attrib in fattrib_ref:
        attribs[attrib]=rarr[fattrib_ref[attrib]];
        if dbg:
          print "r %-20s (%03d) : %-3.2f" % (attrib,fattrib_ref[attrib],attribs[attrib]);

      attribs["ras_normal"]=(attribs["ras_normal_r"],attribs["ras_normal_a"],attribs["ras_normal_s"])
      attribs["ras_center"]=(attribs["ras_center_r"],attribs["ras_center_a"],attribs["ras_center_s"])

      if dbg:
        print attribs;

      attribs['fullpath']=fn;
      attribs['shortname']=re.sub('\.7$','',os.path.basename(fn));

      return attribs;

  @classmethod
  def from_file(cls, filename):
    header=cls.read_header(filename);
    return cls(header);

if __name__=='__main__':
  for k in sys.argv[1:]:
    p=pfile.from_file(k);
    p.describe();
