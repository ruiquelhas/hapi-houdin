'use strict';

const Fs = require('fs');
const Os = require('os');
const Path = require('path');

const Code = require('code');
const Form = require('multi-part');
const Hapi = require('hapi');
const Lab = require('lab');

const Copperfield = require('../lib/');

const lab = exports.lab = Lab.script();

lab.experiment('copperfield', () => {

    let server;
    let png;
    let gif;

    lab.before((done) => {

        server = new Hapi.Server();
        server.connection();

        const setup = {
            register: Copperfield,
            options: {
                whitelist: ['image/png']
            }
        };

        const route = {
            handler: (request, reply) => reply(),
            method: '*',
            path: '/'
        };

        server.route(route);
        server.register(setup, done);
    });

    lab.beforeEach((done) => {
        // Create fake png file
        png = Path.join(Os.tmpdir(), 'foo.png');
        Fs.createWriteStream(png).on('error', done).end(Buffer.from('89504e47', 'hex'), done);
    });

    lab.beforeEach((done) => {
        // Create fake gif file
        gif = Path.join(Os.tmpdir(), 'foo.gif');
        Fs.createWriteStream(gif).on('error', done).end(Buffer.from('47494638', 'hex'), done);
    });

    lab.test('should return error if some file in the payload is not allowed', (done) => {

        const form = new Form();
        form.append('file1', Fs.createReadStream(gif));
        form.append('file2', Fs.createReadStream(png));
        form.append('file3', Fs.createReadStream(gif));
        form.append('foo', 'bar');

        server.inject({ headers: form.getHeaders(), method: 'POST', payload: form.stream(), url: '/' }, (response) => {

            Code.expect(response.statusCode).to.equal(400);
            Code.expect(response.headers['content-validation']).to.equal('failure');
            Code.expect(response.result).to.include(['message', 'validation']);
            Code.expect(response.result.message).to.equal('child \"file1\" fails because [\"file1\" type is not allowed]');
            Code.expect(response.result.validation).to.include(['source', 'keys']);
            Code.expect(response.result.validation.source).to.equal('payload');
            Code.expect(response.result.validation.keys).to.include('file1');
            done();
        });
    });

    lab.test('should return control to the server if all files the payload are allowed', (done) => {

        const form = new Form();
        form.append('file1', Fs.createReadStream(png));
        form.append('file2', Fs.createReadStream(png));
        form.append('foo', 'bar');

        server.inject({ headers: form.getHeaders(), method: 'POST', payload: form.stream(), url: '/' }, (response) => {

            Code.expect(response.statusCode).to.equal(200);
            Code.expect(response.headers['content-validation']).to.equal('success');
            done();
        });
    });
});
