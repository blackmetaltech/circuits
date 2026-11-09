// Constants of nature the engine uses. Region packs may NOT carry or change these (DESIGN §12.2): `validateNodeData` requires the
// copies a pack keeps (so tests can prove no pack tampers with them) to equal this table. The simulator (src/sim) should import
// its thermal voltage from here rather than redefine it.

export const LAWS = {
  /** Boltzmann constant over elementary charge, V/K (CODATA 2018, exact: 1.380649e-23 J/K ÷ 1.602176634e-19 C). */
  kOverQ: 8.617333262e-5,
  /** Reference temperature of the device models, K. */
  tNomK: 300,
  /** Thermal voltage kT/q at 300 K, V (= kOverQ × tNomK, rounded to the 6 digits the models use). */
  vtAt300K: 0.025852,
} as const;
