import * as t from "@babel/types";
import { Plugin } from "../deobfuscator";

export const constantRenamerPlugin: Plugin = {
  name: "constant-renamer",
  visitor: {
    Identifier(path) {
      const replacements: { [key: string]: string } = {
        // Basic values
        W: "ZERO",
        X: "UNDEFINED",
        nn: "NULL",
        rn: "EMPTY_STRING",
        fn: "EMPTY_FUNCTION",
        tn: "Object",

        // Common functions
        on: "isDefined",
        an: "isNotUndefined",
        vn: "getValueOrUndefined",
        _n: "booleanToNumber",
        sn: "includes",
        hn: "getNavigator",
        bn: "getDocument",
        gn: "getScreen",
        pn: "getLocation",
        yn: "setAttribute",
        qn: "map",
        ln: "createArray",

        // Event handling
        dn: "ADD_EVENT_LISTENER",
        zn: "ATTACH_EVENT",
        Mn: "DETACH_EVENT",
        mn: "REMOVE_EVENT_LISTENER",
        kn: "EVENT_PREFIX",
        wn: "addEvent",
        In: "hasAddEventListener",
        xn: "hasAttachEvent",
      };

      const newName = replacements[path.node.name];
      if (newName) {
        // Don't rename if it's a property key
        if (
          t.isMemberExpression(path.parent) &&
          path.parent.property === path.node &&
          !path.parent.computed
        ) {
          return;
        }
        path.replaceWith(t.identifier(newName));
      }
    },
  },
};
