![example workflow](https://github.com/Firkraag/promise/actions/workflows/node.js.yml/badge.svg)
# promise
A javascript promise implementation with the [Promises/A+ specification](https://github.com/promises-aplus/promises-spec)
<a href="https://promisesaplus.com/">
    <img src="https://promisesaplus.com/assets/logo-small.png" alt="Promises/A+ logo"
         title="Promises/A+ 1.0 compliant" align="right" />
</a>
# How To Test
Since this implementation uses rather new features of ES6 to hide private fields and functions of class, so it requires node>=14.0.0.

To test the compliance with the Promises/A+ specification, run:
```bash
npm install
npm run test
```


