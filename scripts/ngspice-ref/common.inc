* common.inc: options and model cards shared by every NODE reference deck.
*
* Solver options: method=trap = trapezoidal integration (NODE DESIGN 3.5; ngspice's first step after t=0 /
* breakpoints is also BE-like). reltol/abstol/vntol are 100x tighter than ngspice defaults so the reference
* is "the exact answer of the model" to > 4 digits. gmin=1e-12 matches NODE's gmin (DESIGN 3.3).
* Temperature: temp=tnom=26.85 C = 300.00 K, so Vt = k*T/q = 25.852 mV (see run.sh VT check), and no
* temperature scaling of Is/Eg happens (temp = tnom).
.options method=trap reltol=1e-5 abstol=1e-12 vntol=1e-7 gmin=1e-12 temp=26.85 tnom=26.85 itl1=500 itl4=100

* Diodes: Shockley D(IS N RS BV IBV) only. CJO=0 TT=0 (no junction/diffusion capacitance), NBV=1 (breakdown
* emission coefficient; NODE's Nbv), (no high-injection knee). Reverse breakdown only where BV is given.
* 1N4148  Is 2.52n N 1.752 Rs 0.568                                   (DESIGN 4.2)
.model D1N4148 D(IS=2.52n N=1.752 RS=0.568 CJO=0 TT=0 BV=1e30 IBV=1e-3 NBV=1)
* 1N4007  CATALOGUE model (src/data/parts/diodes.ts d1n4007, Vishay doc 89789 1n4007.txt): Is 1.43733e-8, N 1.80829, Rs 0.0414712,
*          BV 1100, IBV 10 (breakdown never reached in these decks). MODEL CHANGE (M1-D2b): the earlier decks used the DESIGN recall
*          Is 76.9p N 1.45 Rs 0.042 BV 1000; the reference CSVs of decks 02, 03, 08, 12, 14 were regenerated with the Vishay line.
*          Vishay's cjo 28.1 pF / tt 4.109 us are NOT used (CJO=0 TT=0): NODE models no junction or diffusion capacitance.
.model D1N4007 D(IS=1.43733e-8 N=1.80829 RS=0.0414712 CJO=0 TT=0 BV=1100 IBV=10 NBV=1)
* red LED  N 2.0 Is 1.19e-17 Rs 9.9                                    (DESIGN 4.2 review refit)
.model DLEDRED D(IS=1.19e-17 N=2.0 RS=9.9 CJO=0 TT=0 BV=1e30 IBV=1e-3 NBV=1)
* 1N4733A-style 5.1 V Zener: BV 5.1, IBV 49 mA (Izt), Rs = Zzt 7 ohm - Nbv*Vt/Izt (0.53) = 6.47 ohm.
* Is 1e-14 and N 1 are ESTIMATES (DESIGN gives only BV, Ibv, Rs for Zeners).
.model DZ5V1 D(IS=1e-14 N=1 RS=6.47 CJO=0 TT=0 BV=5.1 IBV=49m NBV=1)
* 2N7000 body diode (separate explicit D, source -> drain): Is 1e-13, N 1, Rs 0.5 are ESTIMATES (DESIGN 3.3 says only "Shockley").
.model DBODY D(IS=1e-13 N=1 RS=0.5 CJO=0 TT=0 BV=1e30 IBV=1e-3 NBV=1)

* BJT: Ebers-Moll (ngspice Gummel-Poon with every high-injection / leakage / resistance / capacitance term zero).
* ISE=ISC=0, IKF=IKR omitted (infinite), RB=RC=RE=0, CJE=CJC=CJS=0, TF=TR=0. NF=NR=1. 2N3904: Is 6.734f Bf 200 Br 0.737 Vaf 74.
* NOTE (Early effect): ngspice Gummel-Poon scales the transport current by 1/(1 - Vbc/VAF) = 1/(1 + (Vce - Vbe)/VAF);
* DESIGN 3.3 writes (1 + Vce/Vaf). They differ by about Vbe/Vaf = 0.9 % in Ic at Vaf 74. See README "Known model differences".
.model Q2N3904 NPN(IS=6.734f BF=200 BR=0.737 VAF=74 NF=1 NR=1 ISE=0 ISC=0 RB=0 RC=0 RE=0 CJE=0 CJC=0 CJS=0 TF=0 TR=0)
* Same without the Early effect (VAF omitted = infinite): identical in NODE and ngspice, used as a formulation-independent check.
.model Q2N3904N NPN(IS=6.734f BF=200 BR=0.737 NF=1 NR=1 ISE=0 ISC=0 RB=0 RC=0 RE=0 CJE=0 CJC=0 CJS=0 TF=0 TR=0)

* MOSFET: Shichman-Hodges Level 1, Vt 2.1, Kp = 1/(2.4*(10-2.1)) = 0.052743 A/V^2 (Rds(on) 2.4 ohm at Vgs 10 V), lambda 0.02.
* Use with W=1 L=1 (so KP is the effective transconductance parameter). GAMMA=0 (no body effect), IS=JS=0 (no built-in
* substrate diode: the body diode is the explicit DBODY), all capacitances 0, RD=RS=0.
.model M2N7000 NMOS(LEVEL=1 VTO=2.1 KP=0.052743 LAMBDA=0.02 GAMMA=0 PHI=0.6 IS=0 JS=0 RD=0 RS=0 CBD=0 CBS=0 CGSO=0 CGDO=0 CGBO=0 CJ=0 CJSW=0)

* Ideal switch (NODE: Ron/Roff event-driven switch). Sharp threshold at 2.5 V (VH=0).
.model SW1 SW(VT=2.5 VH=0 RON=0.05 ROFF=1e9)
