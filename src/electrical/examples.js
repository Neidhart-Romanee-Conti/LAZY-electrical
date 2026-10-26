/* Example projects: the "Voorbeelden" in the File menu, test cases for the layout engine and worked examples for the AI.
   School examples (school: …) use the short school-project format (school.js) that builds the fixed sheet set;
   the others (spec: …) use the free page-description format (auto.js). */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.examples = [
  {
    /* the owner's reference drawing: LOGO! 24, reversing conveyor, emergency stop circuit, interface relays */
    id: 'school_rev', name: 'Omkeerschakeling met LOGO! (school)',
    school: {
      info: { name: 'Loopband links/rechts met LOGO!', desc1: 'Omkeerschakeling met noodstop', author: 'LAZY' },
      plc: '0BA5', estop: true,
      motors: [{ name: 'LOOPBAND', type: 'REV', breaker: 'C10A' }],
      inputs: [{ n: 1, desc: 'STOP', kind: 'NC' }, { n: 2, desc: 'NOODSTOP', kind: 'ESTOP' }, { n: 3, desc: 'THERMISCH CONTACT', kind: 'THERMAL', m: 0 }, { n: 4, desc: 'START RECHTS', kind: 'NO' }, { n: 5, desc: 'START LINKS', kind: 'NO' }],
      outputs: [{ n: 1, desc: 'MOTOR RECHTS', load: 'M:0:right' }, { n: 2, desc: 'MOTOR LINKS', load: 'M:0:left' }]
    }
  },
  {
    /* the owner's hard-wired drawing: direct start with emergency stop, lamps and a motion detector */
    id: 'school_dol', name: 'Direct starten, bedraad (school)',
    school: {
      info: { name: 'Loopband direct starten', desc1: 'Bedrade sturing met noodstop en signaallampen', author: 'LAZY' },
      plc: 'none', estop: true,
      motors: [{ name: 'LOOPBAND', type: 'DOL', breaker: 'C10A' }],
      ladder: { rungs: [
        [{ t: 'NC', kind: 'estop', dev: 'S1', name: 'NOODSTOP' }, { t: 'NC', kind: 'push', dev: 'S2', name: 'STOP' }, { t: 'NC', kind: 'thermal', m: 0 }, { par: [[{ t: 'NO', kind: 'push', dev: 'S3', name: 'START' }], [{ t: 'NO', kind: 'aux', dev: 'Q1' }]] }, { coil: 'Q1', type: 'contactor', name: 'LOOPBAND', drives: '0:run' }],
        [{ t: 'NO', kind: 'aux', dev: 'Q1' }, { lamp: 'P2', name: 'LOOPBAND AAN' }],
        [{ t: 'NC', kind: 'aux', dev: 'Q1' }, { lamp: 'P4', name: 'LOOPBAND UIT' }],
        [{ t: 'NO', kind: 'sensor', dev: 'B5', name: 'BEWEGINGSMELDER' }, { lamp: 'P5', name: 'BEWEGING' }]
      ] }
    }
  },
  {
    id: 'school_yd', name: 'Ster-driehoek met LOGO! (school)',
    school: {
      info: { name: 'Ventilator ster-driehoek met LOGO!', desc1: 'Omschakeling ster naar driehoek door de PLC', author: 'LAZY' },
      plc: '24CE', estop: true,
      motors: [{ name: 'VENTILATOR', type: 'YD', breaker: 'C25A', power: '11 kW' }],
      inputs: [{ n: 1, desc: 'START', kind: 'NO' }, { n: 2, desc: 'STOP', kind: 'NC' }, { n: 3, desc: 'NOODSTOP', kind: 'ESTOP' }, { n: 4, desc: 'THERMISCH CONTACT', kind: 'THERMAL', m: 0 }],
      outputs: [{ n: 1, desc: 'NET', load: 'M:0:main' }, { n: 2, desc: 'STER', load: 'M:0:star' }, { n: 3, desc: 'DRIEHOEK', load: 'M:0:delta' }, { n: 4, desc: 'STORING', load: 'LAMP' }]
    }
  },
  {
    id: 'dol', name: 'Motor direct starten (start/stop) — vrije indeling',
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
    id: 'rev', name: 'Omkeerschakeling (links/rechts) — vrije indeling',
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
    id: 'yd', name: 'Ster-driehoekschakeling met tijdrelais — vrije indeling',
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
    id: 'logo', name: 'Pomp met LOGO! 12/24RCE — vrije indeling',
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
