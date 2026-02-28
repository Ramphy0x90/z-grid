package com.r16a.zeus.features.engine.powerflow;

record ComplexNumber(double re, double im) {
    static final ComplexNumber ZERO = new ComplexNumber(0.0, 0.0);

    ComplexNumber add(ComplexNumber other) {
        return new ComplexNumber(re + other.re, im + other.im);
    }

    ComplexNumber subtract(ComplexNumber other) {
        return new ComplexNumber(re - other.re, im - other.im);
    }

    ComplexNumber multiply(ComplexNumber other) {
        return new ComplexNumber(
                re * other.re - im * other.im,
                re * other.im + im * other.re
        );
    }

    ComplexNumber multiply(double scalar) {
        return new ComplexNumber(re * scalar, im * scalar);
    }

    ComplexNumber divide(ComplexNumber other) {
        double den = other.re * other.re + other.im * other.im;
        return new ComplexNumber(
                (re * other.re + im * other.im) / den,
                (im * other.re - re * other.im) / den
        );
    }

    ComplexNumber divide(double scalar) {
        return new ComplexNumber(re / scalar, im / scalar);
    }

    ComplexNumber conjugate() {
        return new ComplexNumber(re, -im);
    }

    double magnitude() {
        return Math.hypot(re, im);
    }
}
