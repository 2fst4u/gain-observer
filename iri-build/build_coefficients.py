#!/usr/bin/env python3
"""Convert the IRI coefficient files shipped with PyIRI into compact JSON.

Usage:
    python3 iri-build/build_coefficients.py <PyIRI coefficients directory>

Inputs (from the PyIRI 0.1.7 source distribution, MIT licence; the maps
themselves are the IRI/CCIR/URSI coefficient sets PyIRI redistributes):
    URSI/ursiNN.asc  URSI-88 foF2 maps (IRI's default foF2 option)
    CCIR/ccirNN.asc  CCIR-67 maps; only the M(3000)F2 part is used
    IGRF/IGRF13.shc  IGRF-13 Gauss coefficients

Outputs, under src/physics/ionosphere/data/:
    month-MM.json  {"foF2": [...], "m3000": [...]} for month MM, each flat in
                   Fortran (column-major) order over [diurnal j, global k,
                   solar level 0/100], exactly as PyIRI reshapes them.
    igrf.json      {"epochs": [...], "coeffs": [[...], ...]} for 2015-2025.

Only the standard library is used, so the output is reproducible from the
inputs alone. Values are written with the files' own 8 significant digits.
"""
import json
import os
import sys

FOF2_NJ, FOF2_NK = 13, 76
M3000_NJ, M3000_NK = 9, 49
IGRF_EPOCHS = (2015.0, 2020.0, 2025.0)


def read_fortran_e15(path):
    """Read a '(1X,4E15.8)' file: one blank column, then 15-wide fields."""
    values = []
    with open(path, encoding='ascii') as handle:
        for line in handle:
            body = line.rstrip('\n')[1:]
            for i in range(0, len(body), 15):
                field = body[i:i + 15].strip()
                if field:
                    values.append(float(field))
    return values


def compact(values):
    return [float(f'{v:.8g}') for v in values]


def main(coeff_dir):
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'src', 'physics',
                           'ionosphere', 'data')
    os.makedirs(out_dir, exist_ok=True)
    n_fof2 = FOF2_NJ * FOF2_NK * 2
    n_m3000 = M3000_NJ * M3000_NK * 2
    for month in range(1, 13):
        tag = str(month + 10)
        ursi = read_fortran_e15(os.path.join(coeff_dir, 'URSI', f'ursi{tag}.asc'))
        ccir = read_fortran_e15(os.path.join(coeff_dir, 'CCIR', f'ccir{tag}.asc'))
        ccir_fof2_size = n_fof2  # the CCIR file holds foF2 first, then M(3000)F2
        record = {
            'foF2': compact(ursi[:n_fof2]),
            'm3000': compact(ccir[ccir_fof2_size:ccir_fof2_size + n_m3000]),
        }
        if len(record['foF2']) != n_fof2 or len(record['m3000']) != n_m3000:
            raise SystemExit(f'unexpected coefficient count for month {month}')
        with open(os.path.join(out_dir, f'month-{month:02d}.json'), 'w') as f:
            json.dump(record, f, separators=(',', ':'))

    with open(os.path.join(coeff_dir, 'IGRF', 'IGRF13.shc'), encoding='ascii') as f:
        rows = [line.split() for line in f if not line.startswith('#')]
    header, epochs = rows[0], [float(v) for v in rows[1]]
    if header[1] != '13':
        raise SystemExit('expected a degree-13 IGRF file')
    columns = [epochs.index(e) for e in IGRF_EPOCHS]
    data = [[float(v) for v in row[2:]] for row in rows[2:]]
    igrf = {
        'epochs': list(IGRF_EPOCHS),
        'coeffs': [[row[c] for row in data] for c in columns],
    }
    with open(os.path.join(out_dir, 'igrf.json'), 'w') as f:
        json.dump(igrf, f, separators=(',', ':'))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
