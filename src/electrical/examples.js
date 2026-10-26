/* Example projects, written in the same page description format the AI assistant uses.
   They are the "Voorbeelden" in the File menu, the test cases for the layout engine and worked examples for the AI. */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.examples = [
  {
    id: 'dol', name: 'Motor direct starten (start/stop)',
    spec: {
      info: { name: 'Pomp direct starten', desc1: 'Start/stop met motorbeveiligingsschakelaar', author: 'LAZY' },
      settings: { template: 'A3' },
      pages: [
        {
          title: 'Hoofdstroom', top: ['L1', 'L2', 'L3', 'N', 'PE'], bottom: ['1L1', '1N'],
          paths: [
            { macro: 'dol', from: ['L1', 'L2', 'L3'], pe: 'PE', breaker: { s: 'mpcb3', tag: 'Q1', desc: 'POMP' }, contactor: 'K1', term: { tag: 'X1' }, cable: { tag: 'W1', type: 'XVB 4G2,5' }, motor: { tag: 'M1', desc: 'POMP', desc2: '2,2 kW' } },
            { from: ['L1', 'N'], to: ['1L1', '1N'], chain: [{ s: 'mcb2', tag: 'F1', desc: 'STUURKRING' }] }
          ]
        },
        {
          title: 'Stuurstroom', top: ['1L1'], bottom: ['1N'],
          paths: [
            { from: '1L1', to: '1N', chain: [{ s: 'no', tag: 'Q1' }, { s: 'estop', tag: 'S0', desc: 'NOODSTOP' }, { s: 'pb_nc', tag: 'S1', desc: 'STOP' }, { par: [[{ s: 'pb_no', tag: 'S2', desc: 'START' }], [{ s: 'no', tag: 'K1' }]] }, { s: 'coil', tag: 'K1', desc: 'POMP' }] },
            { from: '1L1', to: '1N', chain: [{ s: 'no', tag: 'K1' }, { s: 'lamp', tag: 'P1', desc: 'POMP DRAAIT' }] },
            { from: '1L1', to: '1N', chain: [{ s: 'nc', tag: 'Q1' }, { s: 'lamp', tag: 'P2', desc: 'STORING' }] }
          ]
        }
      ]
    }
  },
  {
    id: 'rev', name: 'Omkeerschakeling (links/rechts)',
    spec: {
      info: { name: 'Transportband omkeren', desc1: 'Rechts/links met elektrische vergrendeling', author: 'LAZY' },
      settings: { template: 'A3' },
      pages: [
        {
          title: 'Hoofdstroom', top: ['L1', 'L2', 'L3', 'N', 'PE'], bottom: ['1L1', '1N'],
          paths: [
            { macro: 'rev', from: ['L1', 'L2', 'L3'], pe: 'PE', breaker: { s: 'mcb3', tag: 'Q1', desc: 'BAND' }, fwd: { tag: 'K1', desc: 'RECHTS' }, rev: { tag: 'K2', desc: 'LINKS' }, ol: { tag: 'F2' }, term: { tag: 'X1' }, cable: { tag: 'W1', type: 'XVB 4G1,5' }, motor: { tag: 'M1', desc: 'BAND', desc2: '1,5 kW' } },
            { from: ['L1', 'N'], to: ['1L1', '1N'], chain: [{ s: 'mcb2', tag: 'F1', desc: 'STUURKRING' }] }
          ]
        },
        {
          title: 'Stuurstroom', top: ['1L1'], bottom: ['1N'],
          paths: [
            {
              from: '1L1', to: '1N', chain: [
                { s: 'th_nc', tag: 'F2' }, { s: 'estop', tag: 'S0', desc: 'NOODSTOP' }, { s: 'pb_nc', tag: 'S1', desc: 'STOP' },
                { par: [
                  [{ par: [[{ s: 'pb_no', tag: 'S2', desc: 'RECHTS' }], [{ s: 'no', tag: 'K1' }]] }, { s: 'nc', tag: 'K2' }, { s: 'coil', tag: 'K1', desc: 'RECHTS' }],
                  [{ par: [[{ s: 'pb_no', tag: 'S3', desc: 'LINKS' }], [{ s: 'no', tag: 'K2' }]] }, { s: 'nc', tag: 'K1' }, { s: 'coil', tag: 'K2', desc: 'LINKS' }]
                ] }
              ]
            },
            { from: '1L1', to: '1N', chain: [{ s: 'no', tag: 'K1' }, { s: 'lamp', tag: 'P1', desc: 'RECHTS' }] },
            { from: '1L1', to: '1N', chain: [{ s: 'no', tag: 'K2' }, { s: 'lamp', tag: 'P2', desc: 'LINKS' }] }
          ]
        }
      ]
    }
  },
  {
    id: 'yd', name: 'Ster-driehoekschakeling met tijdrelais',
    spec: {
      info: { name: 'Ventilator ster-driehoek', desc1: 'Automatische omschakeling na 5 s', author: 'LAZY' },
      settings: { template: 'A3' },
      pages: [
        {
          title: 'Hoofdstroom', top: ['L1', 'L2', 'L3', 'N', 'PE'], bottom: ['1L1', '1N'],
          paths: [
            { macro: 'yd', from: ['L1', 'L2', 'L3'], pe: 'PE', breaker: { s: 'mcb3', tag: 'Q1', desc: 'VENTILATOR' }, main: { tag: 'K1', desc: 'NET' }, star: { tag: 'K2', desc: 'STER' }, delta: { tag: 'K3', desc: 'DRIEHOEK' }, ol: { tag: 'F2' }, term: { tag: 'X1' }, cable: { tag: 'W1', type: 'XVB 7G2,5' }, motor: { tag: 'M1', desc: 'VENTILATOR', desc2: '11 kW' } },
            { from: ['L1', 'N'], to: ['1L1', '1N'], chain: [{ s: 'mcb2', tag: 'F1', desc: 'STUURKRING' }] }
          ]
        },
        {
          title: 'Stuurstroom', top: ['1L1'], bottom: ['1N'],
          paths: [
            {
              from: '1L1', to: '1N', chain: [
                { s: 'th_nc', tag: 'F2' }, { s: 'estop', tag: 'S0', desc: 'NOODSTOP' }, { s: 'pb_nc', tag: 'S1', desc: 'STOP' },
                { par: [[{ s: 'pb_no', tag: 'S2', desc: 'START' }], [{ s: 'no', tag: 'K1' }]] },
                { par: [
                  [{ s: 'coil', tag: 'K1', desc: 'NET' }],
                  [{ s: 'coil_ton', tag: 'K4', desc: 'STER-DRIEHOEK', desc2: '5 s' }],
                  [{ s: 'nc_ton', tag: 'K4' }, { s: 'nc', tag: 'K3' }, { s: 'coil', tag: 'K2', desc: 'STER' }],
                  [{ s: 'no_ton', tag: 'K4' }, { s: 'nc', tag: 'K2' }, { s: 'coil', tag: 'K3', desc: 'DRIEHOEK' }]
                ] }
              ]
            }
          ]
        }
      ]
    }
  },
  {
    id: 'logo', name: 'Pomp met LOGO! 12/24RCE',
    spec: {
      info: { name: 'Pompsturing met LOGO!', desc1: 'Start/stop en niveauvlotter via de PLC', author: 'LAZY' },
      settings: { template: 'A3' },
      devices: { K1: { desc: 'LOGO! 12/24RCE', part: '6ED1 052-1MD08-0BA1', maker: 'Siemens' } },
      pages: [
        {
          title: 'Voeding', top: ['L1', 'L2', 'L3', 'N', 'PE'], bottom: ['+24V', '0V', '1L1', '1N'],
          paths: [
            { macro: 'dol', from: ['L1', 'L2', 'L3'], pe: 'PE', breaker: { s: 'mpcb3', tag: 'Q1', desc: 'POMP' }, contactor: 'K2', term: { tag: 'X1' }, motor: { tag: 'M1', desc: 'POMP' } },
            { from: ['L1', 'N'], pe: 'PE', to: ['+24V', '0V'], chain: [{ s: 'mcb2', tag: 'F1', desc: 'VOEDING' }, { s: 'psu', tag: 'T1', desc: '24V DC' }] },
            { from: ['L1', 'N'], to: ['1L1', '1N'], chain: [{ s: 'mcb2', tag: 'F2', desc: 'UITGANGEN' }] }
          ]
        },
        {
          title: 'PLC ingangen', top: ['+24V'], bottom: ['0V'],
          paths: [
            { from: '+24V', to: '0V', chain: [{ s: 'plc', tag: 'K1' }] },
            { from: '+24V', chain: [{ s: 'pb_no', tag: 'S1', desc: 'START' }, { s: 'plc_di', tag: 'K1', addr: 'I1', desc: 'START' }] },
            { from: '+24V', chain: [{ s: 'pb_nc', tag: 'S2', desc: 'STOP' }, { s: 'plc_di', tag: 'K1', addr: 'I2', desc: 'STOP' }] },
            { from: '+24V', chain: [{ s: 'no', tag: 'Q1' }, { s: 'plc_di', tag: 'K1', addr: 'I3', desc: 'BEVEILIGING OK' }] },
            { from: '+24V', chain: [{ s: 'flt_no', tag: 'B1', desc: 'NIVEAU HOOG' }, { s: 'plc_di', tag: 'K1', addr: 'I4', desc: 'NIVEAU' }] }
          ]
        },
        {
          title: 'PLC uitgangen', top: ['1L1'], bottom: ['1N'],
          paths: [
            { from: '1L1', to: '1N', chain: [{ s: 'plc_do', tag: 'K1', addr: 'Q1' }, { s: 'coil', tag: 'K2', desc: 'POMP' }] },
            { from: '1L1', to: '1N', chain: [{ s: 'plc_do', tag: 'K1', addr: 'Q2' }, { s: 'lamp', tag: 'P1', desc: 'POMP DRAAIT' }] },
            { from: '1L1', to: '1N', chain: [{ s: 'plc_do', tag: 'K1', addr: 'Q3' }, { s: 'horn', tag: 'P2', desc: 'ALARM' }] }
          ]
        }
      ]
    }
  }
];
if (typeof module !== 'undefined') module.exports = LE;
