/* Example projects, written in the same page description format the AI assistant uses.
   They are the "Voorbeelden" in the File menu, the test cases for the layout engine and worked examples for the AI. */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.examples = [
  {
    /* the owner's school layout: supply sheet, control sheet, inputs, outputs (one 24 V interface relay per LOGO! output), power sheet */
    id: 'logo_rev', name: 'Omkeerschakeling met LOGO! (schoolindeling)',
    spec: {
      info: { name: 'Loopband links/rechts met LOGO!', desc1: 'Omkeerschakeling met noodstopkring en interfacerelais', author: 'LAZY' },
      cover: false,
      devices: { K2: { desc: 'LOGO! 24', part: '6ED1 052-1CC00-0BA5', maker: 'Siemens' } },
      pages: [
        {
          title: 'Voedingsblad', top: ['L1', 'L2', 'L3', 'N', 'PE'], mid: ['L1.1', 'L2.1', 'L3.1', 'N.1'],
          paths: [
            { from: ['L1', 'L2', 'L3', 'N'], to: ['L1.1', 'L2.1', 'L3.1', 'N.1'], chain: [{ s: 'term', tag: 'X1' }, { s: 'mcb4', tag: 'Q1', desc: 'HOOFDAUTOMAAT', desc2: 'C20A 4P' }] },
            { from: ['L1.1', 'N.1'], pe: 'PE', out: ['+24V', '0V'], chain: [{ s: 'mcb2', tag: 'F1', desc: 'STUUR 24V', desc2: 'C6A 2P' }, { s: 'psu', tag: 'T1', desc: 'VOEDING', desc2: 'STUUR 24V' }] },
            { from: ['L1.1', 'N.1'], out: ['1L1', '1N'], chain: [{ s: 'mcb2', tag: 'F3', desc: 'STUUR 230V', desc2: 'C10A 2P' }] },
            { from: ['L1.1', 'L2.1', 'L3.1'], out: ['2L1', '2L2', '2L3'], chain: [{ s: 'mcb3', tag: 'F5', desc: 'LOOPBAND', desc2: 'C10A 3P' }] }
          ]
        },
        {
          title: 'Stuurschakeling', top: ['+24V', '1L1'], bottom: ['0V', '1N'],
          paths: [
            { from: '+24V', to: '0V', chain: [{ s: 'logo', tag: 'K2' }] },
            { from: '+24V', to: '0V', chain: [{ s: 'term', tag: 'X2' }, { s: 'estop', tag: 'S5', desc: 'NOODSTOP' }, { s: 'term', tag: 'X2' }, { s: 'coil', tag: 'K5', desc: 'NOOD', desc2: 'WAGO 24V', part: 'GEN-IR-24V-1CO' }] },
            { from: '1L1', to: '1N', chain: [{ s: 'no', tag: 'K5' }, { s: 'coil', tag: 'Q5', desc: 'NOOD', desc2: '230V' }] },
            { from: '1L1', to: '1N', chain: [{ s: 'no', tag: 'K6' }, { s: 'nc', tag: 'Q8' }, { s: 'coil', tag: 'Q7', desc: 'LOOPBAND', desc2: 'RECHTS 230V' }] },
            { from: '1L1', to: '1N', chain: [{ s: 'no', tag: 'K7' }, { s: 'nc', tag: 'Q7' }, { s: 'coil', tag: 'Q8', desc: 'LOOPBAND', desc2: 'LINKS 230V' }] }
          ]
        },
        {
          title: 'Ingangen', top: ['+24V'], bottom: ['0V'],
          paths: [
            { from: '+24V', chain: [{ s: 'term', tag: 'X2' }, { s: 'pb_nc', tag: 'S1', desc: 'STOP' }, { s: 'term', tag: 'X2' }, { s: 'plc_di', tag: 'K2', addr: 'I1', desc: 'STOP' }] },
            { from: '+24V', chain: [{ s: 'term', tag: 'X2' }, { s: 'estop', tag: 'S5' }, { s: 'term', tag: 'X2' }, { s: 'plc_di', tag: 'K2', addr: 'I2', desc: 'NOODSTOP' }] },
            { from: '+24V', chain: [{ s: 'th_nc', tag: 'B1' }, { s: 'plc_di', tag: 'K2', addr: 'I3', desc: 'THERMISCH', desc2: 'CONTACT' }] },
            { from: '+24V', chain: [{ s: 'term', tag: 'X2' }, { s: 'pb_no', tag: 'S6', desc: 'START', desc2: 'RECHTS' }, { s: 'term', tag: 'X2' }, { s: 'plc_di', tag: 'K2', addr: 'I4', desc: 'START RECHTS' }] },
            { from: '+24V', chain: [{ s: 'term', tag: 'X2' }, { s: 'pb_no', tag: 'S7', desc: 'START', desc2: 'LINKS' }, { s: 'term', tag: 'X2' }, { s: 'plc_di', tag: 'K2', addr: 'I5', desc: 'START LINKS' }] }
          ]
        },
        {
          title: 'Uitgangen', top: ['+24V'], bottom: ['0V'],
          paths: [
            { from: '+24V', to: '0V', chain: [{ s: 'plc_do', tag: 'K2', addr: 'Q1', desc: 'MOTOR RECHTS' }, { s: 'coil', tag: 'K6', desc: 'MOTOR RECHTS', desc2: 'WAGO 24V', part: 'GEN-IR-24V-1CO' }] },
            { from: '+24V', to: '0V', chain: [{ s: 'plc_do', tag: 'K2', addr: 'Q2', desc: 'MOTOR LINKS' }, { s: 'coil', tag: 'K7', desc: 'MOTOR LINKS', desc2: 'WAGO 24V', part: 'GEN-IR-24V-1CO' }] }
          ]
        },
        {
          title: 'Vermogenblad', top: ['2L1', '2L2', '2L3', 'PE'],
          paths: [
            { macro: 'rev', from: ['2L1', '2L2', '2L3'], pe: 'PE', breaker: false, pre: [{ s: 'main3', tag: 'Q5' }], fwd: { tag: 'Q7' }, rev: { tag: 'Q8' }, ol: { tag: 'B1' }, term: { tag: 'X3' }, motor: { tag: 'M1', desc: 'LOOPBAND' } }
          ]
        }
      ]
    }
  },
  {
    id: 'dol', name: 'Motor direct starten (start/stop)',
    spec: {
      info: { name: 'Pomp direct starten', desc1: 'Start/stop met motorbeveiligingsschakelaar', author: 'LAZY' },
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
