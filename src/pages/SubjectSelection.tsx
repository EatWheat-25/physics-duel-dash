import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calculator, Atom } from 'lucide-react';

const SubjectSelection: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="p-6">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-12">
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Choose Your Subject
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Select your battlefield and dominate the competition
            </p>
          </motion.div>

          {/* Subject Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl">
            {/* Mathematics */}
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <Link to="/math-modes">
                <div className="cyber-card p-12 hover:scale-105 transition-all duration-300 cursor-pointer group">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Calculator className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-4xl font-bold mb-4 text-foreground">Mathematics</h2>
                    <p className="text-lg text-muted-foreground mb-6">
                      Challenge your algebra, calculus, and analytical skills
                    </p>
                    <div className="flex items-center justify-center gap-2 text-primary font-semibold">
                      <span>Enter Battle Arena</span>
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        →
                      </motion.div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>

            {/* Physics */}
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <Link to="/physics-modes">
                <div className="cyber-card p-12 hover:scale-105 transition-all duration-300 cursor-pointer group">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Atom className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-4xl font-bold mb-4 text-foreground">Physics</h2>
                    <p className="text-lg text-muted-foreground mb-6">
                      Master mechanics, waves, and quantum phenomena
                    </p>
                    <div className="flex items-center justify-center gap-2 text-primary font-semibold">
                      <span>Enter Battle Arena</span>
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        →
                      </motion.div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubjectSelection;